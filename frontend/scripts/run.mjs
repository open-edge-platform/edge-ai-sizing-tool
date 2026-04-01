// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { spawn, execSync, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

// Use PM2_HOME environment variable if set, otherwise fall back to user home directory
const PM2_HOME = process.env.PM2_HOME || path.join(os.homedir(), '.pm2')
const PM2_DUMP = path.join(PM2_HOME, 'dump.pm2')
const isWindows = os.platform() === 'win32'

const getNpmPathWindows = () => {
  try {
    return execSync('where npm.cmd', {
      encoding: 'utf8',
      shell: true,
    })
      .trim()
      .split('\n')[0]
  } catch {
    return 'npm.cmd'
  }
}

const getPm2PathWindows = () => {
  // Check local node_modules first
  const localPm2 = path.join(process.cwd(), 'node_modules', '.bin', 'pm2.cmd')
  if (fs.existsSync(localPm2)) {
    return localPm2
  }

  try {
    return execSync('where pm2.cmd', {
      encoding: 'utf8',
      shell: true,
    })
      .trim()
      .split('\n')[0]
  } catch {
    return 'pm2.cmd'
  }
}

const getNpmPathUnix = () => {
  try {
    return execFileSync('/usr/bin/which', ['npm'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'npm'
  }
}

const getPm2PathUnix = () => {
  try {
    return execFileSync('/usr/bin/which', ['pm2'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'pm2'
  }
}

const ALLOWED_COMMANDS = {
  npm: process.platform === 'win32' ? getNpmPathWindows() : getNpmPathUnix(),
  node: process.execPath,
  pm2: process.platform === 'win32' ? getPm2PathWindows() : getPm2PathUnix(),
}

const sanitizeArg = (arg) => {
  return arg.replace(/[;&|`$(){}[\]<>\\]/g, '')
}

// Helper function to execute commands
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    try {
      const [cmdName, ...rawArgs] = command.split(' ')
      if (isWindows && rawArgs[1] === 'npm') {
        rawArgs[1] = '%NPM_CLI_JS%'
      }

      if (!Object.keys(ALLOWED_COMMANDS).includes(cmdName)) {
        return reject(new Error(`Command not allowed: ${cmdName}`))
      }

      const cmd = ALLOWED_COMMANDS[cmdName]
      const args = rawArgs.map(sanitizeArg)

      const childProcess = spawn(cmd, args, {
        stdio: 'inherit',
        shell: isWindows ? true : false,
      })

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(`Command failed with exit code ${code}`)
        }
      })

      childProcess.on('error', (err) => {
        reject(`Process error: ${err.message}`)
      })
    } catch (err) {
      reject(`Execution error: ${err.message}`)
    }
  })
}

// Check if node_modules exists (for npm install)
const checkNodeModules = () =>
  fs.existsSync(path.join(process.cwd(), 'node_modules'))

// Check if the build directory exists (for npm run build)
const checkBuildDirectory = () =>
  fs.existsSync(path.join(process.cwd(), '.next'))

// Check if PM2 already has applications running
const checkPm2Apps = () => {
  return new Promise((resolve) => {
    const pm2Path = ALLOWED_COMMANDS['pm2']
    const pm2Process = spawn(pm2Path, ['jlist'], {
      shell: isWindows ? true : false,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    let output = ''

    pm2Process.stdout.on('data', (data) => {
      output += data.toString()
    })

    pm2Process.on('close', () => {
      try {
        const processes = JSON.parse(output).map((proc) => ({
          id: proc.pm_id.toString(),
          name: proc.name.replace(/"/g, ''),
          status: proc.pm2_env.status,
        }))
        resolve(processes)
      } catch (err) {
        console.error('Error parsing PM2 JSON output:', err)
        resolve([])
      }
    })

    pm2Process.on('error', (err) => {
      console.error('PM2 process error:', err)
      resolve([])
    })
  })
}

// Main function to run the commands sequentially
const runInstallBuildStart = async () => {
  try {
    const envExamplePath = path.join(process.cwd(), '.env.example')
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
      console.log('Copying .env.example to .env...')
      fs.copyFileSync(envExamplePath, envPath)

      // Generate a random PAYLOAD_SECRET
      const randomSecret = crypto.randomBytes(32).toString('hex')

      // Read the .env file and replace PAYLOAD_SECRET
      let envContent = fs.readFileSync(envPath, 'utf-8')
      envContent = envContent.replace(
        /PAYLOAD_SECRET=/,
        `PAYLOAD_SECRET=${randomSecret}`,
      )
      fs.writeFileSync(envPath, envContent, 'utf-8')

      console.log('PAYLOAD_SECRET has been randomly generated.')
    } else if (!fs.existsSync(envExamplePath)) {
      console.warn('.env.example file is missing. Skipping .env setup.')
    } else {
      console.log('.env file already exists. Skipping copy step.')
    }

    // Check if `npm install` needs to run
    if (!checkNodeModules()) {
      console.log('Running npm install...')
      await runCommand('npm install')
    } else {
      console.log('Skipping npm install (node_modules already exists)')
    }

    // Check if `npm run build` needs to run
    if (!checkBuildDirectory()) {
      console.log('Running npm run build...')
      await runCommand('npm run build')
    } else {
      console.log('Skipping npm run build (build directory already exists)')
    }

    const workersDir = path.resolve(process.cwd(), '..', 'workers')
    const entries = await fs.promises.readdir(workersDir, {
      withFileTypes: true,
    })
    const workerFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(workersDir, entry.name))

    let setupNeeded = false

    for (const workerPath of workerFolders) {
      const venvPath = path.join(workerPath, 'venv')
      if (!fs.existsSync(venvPath)) {
        setupNeeded = true
        break
      }
    }

    if (setupNeeded) {
      console.log('Running setup-workers script...')
      await runCommand('node scripts/setup-workers.mjs')
    } else {
      console.log('Skipping setup-workers (venv folders already exist)')
    }

    // PM2 resurrection logic
    if (fs.existsSync(PM2_DUMP)) {
      await runCommand('pm2 resurrect')
      console.log('PM2 processes restored from dump.')

      // Check for saved online processes state
      const rawHomeDir = os.homedir()
      if (!rawHomeDir || typeof rawHomeDir !== 'string') {
        throw new Error('Invalid home directory')
      }

      // Character-by-character allow-list copy to break taint chain
      const sanitizePathSegment = (input) => {
        const allowedRe = /[A-Za-z0-9_/:\\\-\.]/
        let out = ''
        for (let i = 0; i < input.length; i++) {
          const ch = input.charAt(i)
          if (allowedRe.test(ch)) {
            out += ch
          }
        }
        return out
      }

      const homeDir = sanitizePathSegment(rawHomeDir)

      // Basic checks to reject traversal or empty values
      if (!homeDir || homeDir.includes('..') || homeDir.indexOf('\0') !== -1) {
        throw new Error('Invalid home directory after sanitization')
      }

      // Ensure resulting path is absolute
      if (!path.isAbsolute(homeDir)) {
        throw new Error('Home directory must be an absolute path')
      }

      const pm2Dir = path.resolve(homeDir, '.pm2')
      const stateFile = path.resolve(pm2Dir, 'online-processes.json')

      // Ensure the resolved stateFile path is strictly within the expected PM2 directory
      const normalizedPm2Dir = path.resolve(pm2Dir) + path.sep
      const normalizedStateFile = path.resolve(stateFile)
      if (
        !normalizedStateFile.startsWith(normalizedPm2Dir) &&
        normalizedStateFile !== normalizedPm2Dir
      ) {
        throw new Error('Invalid state file path')
      }

      if (fs.existsSync(stateFile)) {
        try {
          const onlineProcesses = JSON.parse(
            fs.readFileSync(stateFile, 'utf-8'),
          )
          console.log('Restoring previously online processes...')
          for (const processName of onlineProcesses) {
            try {
              await runCommand(`pm2 restart ${processName}`)
            } catch (err) {
              console.log(`Could not restart ${processName}: ${err}`)
            }
          }
          fs.unlinkSync(stateFile)
        } catch (err) {
          console.log('Could not restore online processes state:', err)
        }
      }
    } else {
      console.log('No PM2 dump file found. Skipping resurrection.')
    }

    // Get current process list
    console.log('Getting current PM2 process list...')
    const processes = await checkPm2Apps()
    console.log(
      'Current processes:',
      processes.map((p) => `${p.name}:${p.status}`),
    )

    // Handle EAST application (single consolidated logic)
    const east = processes.find((p) => p.name === 'EAST')
    if (east) {
      if (east.status !== 'online') {
        console.log('Starting EAST process...')
        try {
          await runCommand('pm2 start "EAST"')
        } catch {
          console.log('Start failed, restarting EAST...')
          try {
            await runCommand('pm2 restart "EAST"')
          } catch {
            console.log('Restart failed, recreating EAST...')
            await runCommand('pm2 delete "EAST"')
            await runCommand('pm2 start npm --name "EAST" -- start')
          }
        }
      } else {
        console.log('EAST is already running')
      }
    } else {
      console.log('EAST application not found. Starting EAST...')
      await runCommand('pm2 start npm --name "EAST" -- start')
    }

    // Handle custom-application-profiling service
    const profiling = processes.find(
      (p) => p.name === 'custom-application-profiling',
    )
    const profilingScriptPath = path.resolve(
      process.cwd(),
      '..',
      'workers',
      'custom-application-profiling',
      'main.py',
    )
    const profilingPythonPath = path.resolve(
      process.cwd(),
      '..',
      'workers',
      'custom-application-profiling',
      'venv',
      'bin',
      'python',
    )

    if (fs.existsSync(profilingScriptPath)) {
      if (profiling) {
        if (profiling.status !== 'online') {
          console.log(
            'Deleting and recreating Application Profiling process...',
          )
          try {
            await runCommand('pm2 delete "custom-application-profiling"')
          } catch (err) {
            console.log('Delete failed (process might not exist):', err)
          }

          // Start fresh with correct syntax
          console.log('Starting Application Profiling service with PM2...')
          const startCommand = `pm2 start ${profilingPythonPath} --name custom-application-profiling -- ${profilingScriptPath} api --host 127.0.0.1 --port 6240`
          console.log(`Executing: ${startCommand}`)
          await runCommand(startCommand)
          console.log('Waiting for baseline establishment...')
          await new Promise((resolve) => setTimeout(() => resolve(), 5000))
        } else {
          console.log('Application Profiling is already running')
        }
      } else {
        console.log('Starting Application Profiling service with PM2...')
        // FIXED: Correct PM2 command syntax
        const startCommand = `pm2 start ${profilingPythonPath} --name custom-application-profiling -- ${profilingScriptPath} api --host 127.0.0.1 --port 6240`
        console.log(`Executing: ${startCommand}`)
        await runCommand(startCommand)
        console.log('Waiting for baseline establishment...')
        await new Promise((resolve) => setTimeout(() => resolve(), 5000))
      }
    } else {
      console.log('Application Profiling worker not found, skipping...')
    }

    // Get updated process list and handle other processes
    const updatedProcesses = await checkPm2Apps()
    const mainServices = ['custom-application-profiling', 'EAST']

    for (const proc of updatedProcesses) {
      if (!mainServices.includes(proc.name) && proc.status !== 'online') {
        try {
          console.log(`Starting ${proc.name}...`)
          await runCommand(`pm2 start ${proc.name}`)
        } catch (err) {
          console.log(`Failed to start ${proc.name}: ${err}`)
        }
      }
    }

    await runCommand('pm2 save')
    console.log('All services started successfully!')
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

runInstallBuildStart()
