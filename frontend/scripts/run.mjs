// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const getNpmPathWindows = () => {
  try {
    return execSync('where npm.cmd', { 
      encoding: 'utf8',
      shell: true 
    }).trim().split('\n')[0]
  } catch (error) {
    return 'npm.cmd'
  }
}

const getPm2PathWindows = () => {
  try {
    return execSync('where pm2.cmd', { 
      encoding: 'utf8',
      shell: true 
    }).trim().split('\n')[0]
  } catch (error) {
    return 'pm2.cmd'
  }
}

const getNpmPathUnix = () => {
  try {
    const { execFileSync } = require('child_process')
    return execFileSync('/usr/bin/which', ['npm'], {
      encoding: 'utf8'
    }).trim()
  } catch (error) {
    return 'npm'
  }
}

const getPm2PathUnix = () => {
  try {
    const { execFileSync } = require('child_process')
    return execFileSync('/usr/bin/which', ['pm2'], {
      encoding: 'utf8'
    }).trim()
  } catch (error) {
    return 'pm2'
  }
}

const ALLOWED_COMMANDS = {
  'npm': process.platform === 'win32' ? getNpmPathWindows() : getNpmPathUnix(),
  'node': process.execPath,
  'pm2': process.platform === 'win32' ? getPm2PathWindows() : getPm2PathUnix(),
}

const sanitizeArg = (arg) => {
  return arg.replace(/[;&|`$(){}[\]<>\\]/g, '')
}

// Helper function to execute commands
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    try {
      const [cmdName, ...rawArgs] = command.split(' ')

      if (!Object.keys(ALLOWED_COMMANDS).includes(cmdName)) {
        return reject(new Error(`Command not allowed: ${cmdName}`))
      }

      const cmd = ALLOWED_COMMANDS[cmdName]  
      const args = rawArgs.map(sanitizeArg)

      const process = spawn(cmd, args, {
        stdio: 'inherit',
        shell: false
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(`Command failed with exit code ${code}`)
        }
      })

      process.on('error', (err) => {
        reject(`Process error: ${err.message}`)
      })
    } catch (err) {
      reject(`Execution error: ${err.message}`)
    }
  })
}

// Check if node_modules exists (for npm install)
const checkNodeModules = () => fs.existsSync(path.join(process.cwd(), 'node_modules'))

// Check if the build directory exists (for npm run build)
const checkBuildDirectory = () => fs.existsSync(path.join(process.cwd(), '.next'))

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
    const entries = await fs.promises.readdir(workersDir, { withFileTypes: true })
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

    // Check if PM2 already has an EAST application
    console.log('Checking for existing PM2 EAST application...')
    const checkPm2App = () => {
      return new Promise((resolve) => {
        const pm2Path = ALLOWED_COMMANDS['pm2']
        const pm2Process = spawn(pm2Path, ['list'], { 
          shell: false,
          stdio: ['ignore', 'pipe', 'ignore'] 
        })
        let output = ''

        pm2Process.stdout.on('data', (data) => {
          output += data.toString()
        })

        pm2Process.on('close', () => {
          resolve(output.includes('EAST'))
        })

        pm2Process.on('error', (err) => {
          resolve(false)
        })
      })
    }

    const eastAppExists = await checkPm2App()

    if (eastAppExists) {
      console.log('EAST application found in PM2, resurrecting...')
      await runCommand('pm2 resurrect')
      await runCommand('pm2 start all')
    } else {
      console.log('Starting EAST application with PM2...')
      await runCommand('pm2 start npm --name "EAST" -- start')
    }
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

runInstallBuildStart()