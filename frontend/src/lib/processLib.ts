// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const isWindows = os.platform() === 'win32'

const BASE_DIR = process.cwd()
const PROCESSES_DIR = path.join(BASE_DIR, '.processes')
const LOGS_DIR = path.join(BASE_DIR, '.logs')

interface ProcessInfo {
  pid: number | null
  interpreter: string
  script: string
  args: string[]
}

function readProcessInfo(name: string): ProcessInfo | null {
  name = name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  const infoPath = path.join(PROCESSES_DIR, `${name}.json`)
  if (!fs.existsSync(infoPath)) return null
  try {
    return JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
  } catch {
    return null
  }
}

function writeProcessInfo(name: string, info: ProcessInfo): void {
  if (!fs.existsSync(PROCESSES_DIR)) {
    fs.mkdirSync(PROCESSES_DIR, { recursive: true })
  }
  name = name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  fs.writeFileSync(
    path.join(PROCESSES_DIR, `${name}.json`),
    JSON.stringify(info, null, 2),
    'utf-8',
  )
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killProcess(pid: number): void {
  if (isWindows) {
    try {
      execSync(`taskkill /F /T /PID ${pid.toString()}`, { stdio: 'ignore' })
    } catch {
      // Process may have already exited
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // Process may have already exited
      }
    }
  }
}

export async function startWorkerProcess(
  processName: string,
  scriptName: string,
  params: string,
): Promise<void> {
  // Basic sanitization to prevent command injection
  processName = processName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  scriptName = scriptName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  params = params?.replace(/[^\w.@\-\/\\ :,]/g, '') || ''

  let interpreter: string
  let script: string
  let args: string[]

  if (!scriptName && !params) {
    // Restart from saved process info
    const info = readProcessInfo(processName)
    if (!info) {
      console.error(`No saved process info for ${processName}, cannot restart`)
      return
    }

    // Kill existing process if still running
    if (info.pid && isProcessRunning(info.pid)) {
      killProcess(info.pid)
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
    }

    interpreter = info.interpreter
    script = info.script
    args = info.args
  } else {
    const scriptFolder = path.resolve(
      path.dirname(''),
      '../workers',
      scriptName.replace(/\s+/g, '-'),
    )

    // Construct the path to the Python interpreter in the virtual environment
    interpreter = isWindows
      ? path.join(scriptFolder, 'venv', 'Scripts', 'pythonw.exe')
      : path.join(scriptFolder, 'venv', 'bin', 'python')

    script = path.join(scriptFolder, 'main.py')
    args = params.split(/\s+/).filter(Boolean)
  }

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }

  const outLog = fs.openSync(path.join(LOGS_DIR, `${processName}-out.log`), 'a')
  const errLog = fs.openSync(
    path.join(LOGS_DIR, `${processName}-error.log`),
    'a',
  )

  const child = spawn(interpreter, [script, ...args], {
    detached: true,
    stdio: ['ignore', outLog, errLog],
    cwd: process.cwd(),
  })

  child.on('error', (err) => {
    console.error(`Failed to start process ${processName}: ${err.message}`)
  })

  const info: ProcessInfo = {
    pid: child.pid ?? null,
    interpreter,
    script,
    args,
  }

  writeProcessInfo(processName, info)
  console.log(`Started process ${processName} (PID: ${child.pid})`)

  child.unref()
}

export async function stopWorkerProcess(processName: string): Promise<void> {
  processName = processName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  const info = readProcessInfo(processName)
  if (!info || !info.pid) {
    console.log(`No running process found for ${processName}`)
    return
  }

  if (isProcessRunning(info.pid)) {
    console.log(`Stopping process ${processName} (PID: ${info.pid})...`)
    killProcess(info.pid)

    // Wait for process to terminate
    let retries = 10
    while (retries > 0 && isProcessRunning(info.pid)) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
      retries--
    }

    if (isProcessRunning(info.pid)) {
      console.log(`Force killing process ${processName}...`)
      if (isWindows) {
        try {
          execSync(`taskkill /F /T /PID ${info.pid}`, { stdio: 'ignore' })
        } catch {
          // Process may have already exited
        }
      } else {
        try {
          process.kill(-info.pid, 'SIGKILL')
        } catch {
          try {
            process.kill(info.pid, 'SIGKILL')
          } catch {
            // Process may have already exited
          }
        }
      }
    }
  }

  // Keep the process info file (without PID) so it can be restarted
  info.pid = null
  writeProcessInfo(processName, info)
  console.log(`Process ${processName} stopped.`)
}

export async function deleteWorkerProcess(processName: string): Promise<void> {
  processName = processName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  const info = readProcessInfo(processName)

  if (info && info.pid && isProcessRunning(info.pid)) {
    killProcess(info.pid)
  }

  // Remove process info file
  const infoPath = path.join(PROCESSES_DIR, `${processName}.json`)
  if (fs.existsSync(infoPath)) {
    fs.unlinkSync(infoPath)
  }

  // Remove log files
  const outLogPath = path.join(LOGS_DIR, `${processName}-out.log`)
  const errLogPath = path.join(LOGS_DIR, `${processName}-error.log`)
  if (fs.existsSync(outLogPath)) fs.unlinkSync(outLogPath)
  if (fs.existsSync(errLogPath)) fs.unlinkSync(errLogPath)

  console.log(`Process ${processName} deleted.`)
}
