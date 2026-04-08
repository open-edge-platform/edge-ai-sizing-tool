#!/usr/bin/env node

// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const isWindows = os.platform() === 'win32'
const PID_FILE = path.join(process.cwd(), '.east.pid')
const PROCESSES_DIR = path.join(process.cwd(), '.processes')
const RUNNING_WORKERS_FILE = path.join(process.cwd(), '.east.running-workers')

const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const stopProcess = async () => {
  try {
    if (!fs.existsSync(PID_FILE)) {
      console.log('No EAST process found (no PID file).')
      return
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (!pid || isNaN(pid)) {
      console.log('Invalid PID file. Removing...')
      fs.unlinkSync(PID_FILE)
      return
    }

    if (!isProcessRunning(pid)) {
      console.log(`EAST process (PID: ${pid}) is not running.`)
      fs.unlinkSync(PID_FILE)
      return
    }

    console.log(`Stopping EAST process (PID: ${pid})...`)
    if (isWindows) {
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' })
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

    // Wait for process to terminate
    let retries = 10
    while (retries > 0 && isProcessRunning(pid)) {
      await new Promise((resolve) => setTimeout(() => resolve(), 500))
      retries--
    }

    // Force kill if still running
    if (isProcessRunning(pid)) {
      console.log('Process did not terminate gracefully, force killing...')
      if (isWindows) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' })
        } catch {
          // Process may have already exited
        }
      } else {
        try {
          process.kill(-pid, 'SIGKILL')
        } catch {
          try {
            process.kill(pid, 'SIGKILL')
          } catch {
            // Process may have already exited
          }
        }
      }
    }

    console.log('EAST process stopped successfully.')
    fs.unlinkSync(PID_FILE)

    // Stop all running worker processes
    await stopAllWorkers()
  } catch (error) {
    console.error('An error occurred:', error)
    process.exit(1)
  }
}

const killWorkerProcess = (pid) => {
  const safePid = parseInt(pid, 10)
  if (!Number.isFinite(safePid) || safePid <= 0) return
  if (isWindows) {
    try {
      execSync(`taskkill /F /T /PID ${safePid}`, { stdio: 'ignore' })
    } catch {
      // Process may have already exited
    }
  } else {
    try {
      process.kill(-safePid, 'SIGTERM')
    } catch {
      try {
        process.kill(safePid, 'SIGTERM')
      } catch {
        // Process may have already exited
      }
    }
  }
}

const stopAllWorkers = async () => {
  if (!fs.existsSync(PROCESSES_DIR)) return

  let processFiles
  try {
    processFiles = fs
      .readdirSync(PROCESSES_DIR)
      .filter((f) => f.endsWith('.json'))
  } catch {
    return
  }

  const runningWorkers = []

  for (const file of processFiles) {
    const filePath = path.join(PROCESSES_DIR, file)
    let info
    try {
      info = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      continue
    }

    if (!info.pid || !isProcessRunning(info.pid)) continue

    const workerName = file.replace(/\.json$/, '')
    console.log(`Stopping worker process ${workerName} (PID: ${info.pid})...`)
    killWorkerProcess(info.pid)

    // Wait for it to exit
    let retries = 10
    while (retries > 0 && isProcessRunning(info.pid)) {
      await new Promise((resolve) => setTimeout(() => resolve(), 500))
      retries--
    }

    if (isProcessRunning(info.pid)) {
      const safePid = parseInt(info.pid, 10)
      if (Number.isFinite(safePid) && safePid > 0) {
        if (isWindows) {
          try {
            execSync(`taskkill /F /T /PID ${safePid}`, { stdio: 'ignore' })
          } catch {
            // ignore
          }
        } else {
          try {
            process.kill(-safePid, 'SIGKILL')
          } catch {
            try {
              process.kill(safePid, 'SIGKILL')
            } catch {
              // ignore
            }
          }
        }
      }
    }

    info.pid = null
    try {
      fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf-8')
    } catch {
      // ignore
    }
    runningWorkers.push(workerName)
    console.log(`Worker process ${workerName} stopped.`)
  }

  if (runningWorkers.length > 0) {
    fs.writeFileSync(
      RUNNING_WORKERS_FILE,
      JSON.stringify(runningWorkers),
      'utf-8',
    )
    console.log(`Saved ${runningWorkers.length} running worker(s) for restart.`)
  }
}

stopProcess()
