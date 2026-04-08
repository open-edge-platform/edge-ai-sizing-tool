// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { spawn, execSync, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

const isWindows = os.platform() === 'win32'
const PID_FILE = path.join(process.cwd(), '.east.pid')
const PROCESSES_DIR = path.join(process.cwd(), '.processes')
const RUNNING_WORKERS_FILE = path.join(process.cwd(), '.east.running-workers')

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

const getNpmPathUnix = () => {
  try {
    return execFileSync('/usr/bin/which', ['npm'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'npm'
  }
}

const ALLOWED_COMMANDS = {
  npm: process.platform === 'win32' ? getNpmPathWindows() : getNpmPathUnix(),
  node: process.execPath,
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

    // Check for an existing EAST process and stop it if running
    const isProcessRunning = (pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }

    if (fs.existsSync(PID_FILE)) {
      try {
        const existingPid = parseInt(
          fs.readFileSync(PID_FILE, 'utf-8').trim(),
          10,
        )
        if (existingPid && isProcessRunning(existingPid)) {
          console.log(`Stopping existing EAST process (PID: ${existingPid})...`)
          if (isWindows) {
            try {
              execSync(`taskkill /F /T /PID ${existingPid}`, {
                stdio: 'ignore',
              })
            } catch {
              // Process may have already exited
            }
          } else {
            try {
              process.kill(-existingPid, 'SIGTERM')
            } catch {
              try {
                process.kill(existingPid, 'SIGTERM')
              } catch {
                // Process may have already exited
              }
            }
          }
          // Wait a moment for process to clean up
          await new Promise((resolve) => setTimeout(() => resolve(), 1000))
        }
      } catch {
        // PID file may be corrupt, continue
      }
    }

    // Start the EAST application as a detached background process
    console.log('Starting EAST application...')
    const logDir = path.join(process.cwd(), '.logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const outLog = fs.openSync(path.join(logDir, 'east-out.log'), 'a')
    const errLog = fs.openSync(path.join(logDir, 'east-err.log'), 'a')

    // Spawn next start directly so child.pid is the actual server process.
    const nextScript = path.join(
      process.cwd(),
      'node_modules',
      'next',
      'dist',
      'bin',
      'next',
    )
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
    )
    const startScriptMatch = (pkg.scripts?.start ?? '').match(/next\s+(.+)$/)
    const nextArgs = startScriptMatch
      ? startScriptMatch[1].trim().split(/\s+/)
      : ['start', '-p', '8080']

    const child = spawn(process.execPath, [nextScript, ...nextArgs], {
      detached: true,
      stdio: ['ignore', outLog, errLog],
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      shell: isWindows ? true : false,
    })

    child.on('error', (err) => {
      console.error('Failed to start EAST application:', err.message)
      process.exit(1)
    })

    // Save PID to file
    fs.writeFileSync(PID_FILE, String(child.pid), 'utf-8')
    console.log(`EAST application started (PID: ${child.pid})`)
    console.log(`Logs: ${logDir}`)

    // Allow parent to exit independently
    child.unref()

    // Recover workers that had a non-null PID but are no longer running (e.g. after a reboot)
    // These are workers that were running but were never stopped cleanly via stop.mjs
    if (fs.existsSync(PROCESSES_DIR)) {
      let processFiles = []
      try {
        processFiles = fs
          .readdirSync(PROCESSES_DIR)
          .filter((f) => f.endsWith('.json'))
      } catch {
        // ignore
      }

      for (const file of processFiles) {
        const filePath = path.join(PROCESSES_DIR, file)
        let info
        try {
          info = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        } catch {
          continue
        }

        // pid is non-null but process is not running → it died unexpectedly (reboot/crash)
        if (!info.pid) continue
        let alive = false
        try {
          process.kill(info.pid, 0)
          alive = true
        } catch {
          // not running
        }
        if (alive) continue
        if (!info.interpreter || !info.script) continue
        if (!fs.existsSync(info.interpreter) || !fs.existsSync(info.script))
          continue

        const workerName = file.replace(/\.json$/, '')
        console.log(
          `Recovering worker ${workerName} after unexpected shutdown...`,
        )
        const workerOut = fs.openSync(
          path.join(logDir, `${workerName}-out.log`),
          'a',
        )
        const workerErr = fs.openSync(
          path.join(logDir, `${workerName}-error.log`),
          'a',
        )

        const recoveredChild = spawn(
          info.interpreter.toString(),
          [info.script.toString(), ...(info.args || [])],
          {
            detached: true,
            stdio: ['ignore', workerOut, workerErr],
            cwd: process.cwd(),
            shell: false,
          },
        )

        recoveredChild.on('error', (err) => {
          console.error(
            `Failed to recover worker ${workerName}: ${err.message}`,
          )
        })

        info.pid = recoveredChild.pid ?? null
        try {
          fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf-8')
        } catch {
          // ignore
        }
        console.log(
          `Worker ${workerName} recovered (PID: ${recoveredChild.pid})`,
        )
        recoveredChild.unref()
      }
    }

    // Restart worker processes that were running before the last clean stop
    if (fs.existsSync(RUNNING_WORKERS_FILE)) {
      let runningWorkers = []
      try {
        runningWorkers = JSON.parse(
          fs.readFileSync(RUNNING_WORKERS_FILE, 'utf-8'),
        )
      } catch {
        // ignore corrupt file
      }

      for (const workerName of runningWorkers) {
        const infoPath = path.join(PROCESSES_DIR, `${workerName}.json`)
        if (!fs.existsSync(infoPath)) {
          console.log(`Skipping worker ${workerName}: no saved process info.`)
          continue
        }

        let info
        try {
          info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
        } catch {
          console.log(
            `Skipping worker ${workerName}: could not read process info.`,
          )
          continue
        }

        if (!info.interpreter || !info.script) {
          console.log(
            `Skipping worker ${workerName}: missing interpreter or script path.`,
          )
          continue
        }

        if (!fs.existsSync(info.interpreter) || !fs.existsSync(info.script)) {
          console.log(
            `Skipping worker ${workerName}: interpreter or script not found on disk.`,
          )
          continue
        }

        console.log(`Restarting worker process ${workerName}...`)
        const workerOut = fs.openSync(
          path.join(logDir, `${workerName}-out.log`),
          'a',
        )
        const workerErr = fs.openSync(
          path.join(logDir, `${workerName}-error.log`),
          'a',
        )

        const workerChild = spawn(
          info.interpreter.toString(),
          [info.script.toString(), ...(info.args || [])],
          {
            detached: true,
            stdio: ['ignore', workerOut, workerErr],
            cwd: process.cwd(),
            shell: false,
          },
        )

        workerChild.on('error', (err) => {
          console.error(
            `Failed to restart worker ${workerName}: ${err.message}`,
          )
        })

        info.pid = workerChild.pid ?? null
        try {
          fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf-8')
        } catch {
          // ignore
        }
        console.log(`Worker ${workerName} restarted (PID: ${workerChild.pid})`)
        workerChild.unref()
      }

      try {
        fs.unlinkSync(RUNNING_WORKERS_FILE)
      } catch {
        // ignore
      }
    } else {
      console.log('No previously running workers to restart.')
    }

    // Handle custom-application-profiling service
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

    if (
      fs.existsSync(profilingScriptPath) &&
      fs.existsSync(profilingPythonPath)
    ) {
      const profilingInfoPath = path.join(
        PROCESSES_DIR,
        'custom-application-profiling.json',
      )

      let profilingAlreadyRunning = false
      if (fs.existsSync(profilingInfoPath)) {
        try {
          const profilingInfo = JSON.parse(
            fs.readFileSync(profilingInfoPath, 'utf-8'),
          )
          if (profilingInfo.pid) {
            try {
              process.kill(profilingInfo.pid, 0)
              profilingAlreadyRunning = true
              console.log('Application Profiling is already running')
            } catch {
              // not running
            }
          }
        } catch {
          // ignore corrupt file
        }
      }

      if (!profilingAlreadyRunning) {
        console.log('Starting Application Profiling service...')
        if (!fs.existsSync(PROCESSES_DIR)) {
          fs.mkdirSync(PROCESSES_DIR, { recursive: true })
        }
        const profilingOut = fs.openSync(
          path.join(logDir, 'custom-application-profiling-out.log'),
          'a',
        )
        const profilingErr = fs.openSync(
          path.join(logDir, 'custom-application-profiling-error.log'),
          'a',
        )

        const profilingChild = spawn(
          profilingPythonPath,
          [profilingScriptPath, 'api', '--host', '127.0.0.1', '--port', '6240'],
          {
            detached: true,
            stdio: ['ignore', profilingOut, profilingErr],
            cwd: process.cwd(),
            shell: false,
          },
        )

        profilingChild.on('error', (err) => {
          console.error(`Failed to start Application Profiling: ${err.message}`)
        })

        const profilingSaveInfo = {
          pid: profilingChild.pid ?? null,
          interpreter: profilingPythonPath,
          script: profilingScriptPath,
          args: ['api', '--host', '127.0.0.1', '--port', '6240'],
        }
        try {
          fs.writeFileSync(
            profilingInfoPath,
            JSON.stringify(profilingSaveInfo, null, 2),
            'utf-8',
          )
        } catch {
          // ignore
        }
        console.log(
          `Application Profiling started (PID: ${profilingChild.pid})`,
        )
        console.log('Waiting for baseline establishment...')
        await new Promise((resolve) => setTimeout(() => resolve(), 5000))
        profilingChild.unref()
      }
    } else {
      console.log('Application Profiling worker not found, skipping...')
    }

    console.log('All services started successfully!')
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

runInstallBuildStart()
