#!/usr/bin/env node

// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'
import fs, { promises as fsPromises } from 'fs'
import path from 'path'
import os from 'os'

// Determine if the operating system is Windows
const isWindows = os.platform() === 'win32'
// Get the current file and directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Resolve Python path on Windows
function getPythonPathWindows() {
  try {
    return execSync('where python', {
      encoding: 'utf8',
      shell: true,
    })
      .trim()
      .split('\n')[0]
  } catch {
    // Default fallback
    return 'python'
  }
}

// Resolve Python path on Unix
function getPythonPathUnix() {
  try {
    return execFileSync('/usr/bin/which', ['python3'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    // Default fallback
    return 'python3'
  }
}

function getThirdpartyPath() {
  return path.join(__dirname, '../../', 'thirdparty')
}

// Resolve uv path on Windows
function getUvPathWindows() {
  try {
    return path.join(getThirdpartyPath(), 'uv', 'uv.exe')
  } catch {
    // Default fallback
    return 'uv'
  }
}

// Resolve uv path on Unix
function getUvPathUnix() {
  try {
    return execFileSync('/usr/bin/which', ['uv'], {
      encoding: 'utf8',
      shell: true,
    }).trim()
  } catch {
    // Check system-wide location
    if (fs.existsSync('/usr/local/bin/uv')) {
      return '/usr/local/bin/uv'
    }
    // Default fallback
    return 'uv'
  }
}

// Build allowlist for commands
const ALLOWED_COMMANDS = {
  python: isWindows ? getPythonPathWindows() : getPythonPathUnix(),
  python3: getPythonPathUnix(),
  uv: isWindows ? getUvPathWindows() : getUvPathUnix(),
}

// A simple sanitizer for arguments
function sanitizeArg(arg) {
  // Normalize Windows paths to use forward slashes
  let normalized = arg
  if (isWindows && (arg.includes(':\\') || arg.includes('\\'))) {
    normalized = arg.replace(/\\/g, '/')
  }
  // Remove potentially dangerous characters
  return normalized.replace(/[;&|`$(){}[\]<>]/g, '')
}

// Helper function to run shell commands with inline sanitization
function runCommand(command, args, options = {}) {
  // If the initial "command" is not in our allowlist, reject
  if (!Object.keys(ALLOWED_COMMANDS).includes(command)) {
    throw new Error(`Command not allowed: ${command}`)
  }

  // Map to actual system command
  const safeCommand = ALLOWED_COMMANDS[command]

  // Sanitize each argument
  const sanitizedArgs = args.map(sanitizeArg)

  return new Promise((resolve, reject) => {
    const proc = spawn(safeCommand, sanitizedArgs, {
      stdio: 'inherit',
      shell: isWindows ? true : false,
      ...options,
    })
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${safeCommand} ${sanitizedArgs.join(' ')} exited with code ${code}`,
          ),
        )
      } else {
        resolve()
      }
    })
    proc.on('error', (err) => {
      reject(new Error(`Process error: ${err.message}`))
    })
  })
}

// Function to produce an ISO-like timestamp
function getTimestamp() {
  const now = new Date()
  const tzOffset = -now.getTimezoneOffset()
  const diff = tzOffset >= 0 ? '+' : '-'
  const pad = (n) => n.toString().padStart(2, '0')
  const offsetHours = pad(Math.floor(Math.abs(tzOffset) / 60))
  const offsetMinutes = pad(Math.abs(tzOffset) % 60)
  const year = now.getFullYear()
  const month = pad(now.getMonth() + 1)
  const day = pad(now.getDate())
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${diff}${offsetHours}:${offsetMinutes}`
}

// Function to set up each worker
async function setupWorker(workerDir) {
  console.log(`[${getTimestamp()}] Setting up worker in ${workerDir}`)

  // Path to the Python executable within the virtual environment
  const venvPython = path.join(
    workerDir,
    'venv',
    isWindows ? 'Scripts' : 'bin',
    isWindows ? 'python.exe' : 'python',
  )

  // Create the virtual environment
  await runCommand('uv', ['venv', 'venv'], { cwd: workerDir })

  // Install dependencies from requirements.txt
  await runCommand(
    'uv',
    [
      'pip',
      'install',
      '--python',
      venvPython,
      '-r',
      'requirements.txt',
      '--index-strategy',
      'unsafe-best-match',
    ],
    {
      cwd: workerDir,
    },
  )
}

// Function to iterate and set up all workers
async function setupAllWorkers() {
  try {
    const startTime = Date.now()
    const workersDir = path.resolve(process.cwd(), '..', 'workers')
    const entries = await fsPromises.readdir(workersDir, {
      withFileTypes: true,
    })
    const workerFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(workersDir, entry.name))

    for (const workerPath of workerFolders) {
      await setupWorker(workerPath)
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(
      `[${getTimestamp()}] Completed Python venv setup for all workers.`,
    )
    console.log(`[${getTimestamp()}] Total duration: ${duration} seconds`)
  } catch (err) {
    console.error(`Error setting up workers: ${err.message}`)
    process.exit(1)
  }
}

// Execute the setup for all workers
setupAllWorkers()
