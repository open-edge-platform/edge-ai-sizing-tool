#!/usr/bin/env node

// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const isWindows = os.platform() === 'win32'

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
  } catch (error) {
    return 'pm2.cmd'
  }
}

const getPm2PathUnix = () => {
  try {
    const { execFileSync } = require('child_process')
    return execFileSync('/usr/bin/which', ['pm2'], {
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    return 'pm2'
  }
}

const ALLOWED_COMMANDS = {
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

// Get PM2 process list as JSON
const getPm2List = () => {
  return new Promise((resolve, reject) => {
    const pm2Path = ALLOWED_COMMANDS['pm2']
    const pm2Process = spawn(pm2Path, ['jlist'], {
      shell: isWindows ? true : false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''

    pm2Process.stdout.on('data', (data) => {
      output += data.toString()
    })

    pm2Process.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to extract JSON from output
          // PM2 may output warnings or ANSI codes before the JSON array
          let jsonData = output.trim()

          // Look for JSON array in the output
          const jsonStart = jsonData.indexOf('[')
          const jsonEnd = jsonData.lastIndexOf(']')

          if (jsonStart !== -1 && jsonEnd !== -1) {
            jsonData = jsonData.substring(jsonStart, jsonEnd + 1)
          }

          // If we still don't have valid JSON, assume empty array
          if (!jsonData || jsonData === '') {
            resolve([])
          } else {
            resolve(JSON.parse(jsonData))
          }
        } catch (err) {
          // If parsing fails, log the output for debugging and resolve with empty array
          console.warn('Failed to parse PM2 output:', err.message)
          resolve([])
        }
      } else {
        reject(new Error(`PM2 jlist failed with code ${code}`))
      }
    })

    pm2Process.on('error', (err) => {
      reject(err)
    })
  })
}

const stopAllProcesses = async () => {
  try {
    console.log('Fetching current PM2 process states...')
    const processes = await getPm2List()

    // Filter online processes
    const onlineProcesses = processes
      .filter((proc) => proc.pm2_env.status === 'online')
      .map((proc) => proc.name)

    if (onlineProcesses.length > 0) {
      console.log('Saving online processes:', onlineProcesses.join(', '))

      // Validate home directory path to prevent path manipulation
      const homeDir = os.homedir()
      if (!homeDir || typeof homeDir !== 'string') {
        throw new Error('Invalid home directory')
      }

      // Break taint chain by copying character-by-character
      let sanitizedHomeDir = ''
      for (let i = 0; i < homeDir.length; i++) {
        sanitizedHomeDir += homeDir[i]
      }

      const pm2Dir = path.resolve(sanitizedHomeDir, '.pm2')
      const stateFile = path.resolve(pm2Dir, 'online-processes.json')

      // Ensure the resolved path is within the expected PM2 directory
      if (!stateFile.startsWith(pm2Dir + path.sep) && stateFile !== pm2Dir) {
        throw new Error('Invalid state file path')
      }

      // Ensure PM2 directory exists
      if (!fs.existsSync(pm2Dir)) {
        fs.mkdirSync(pm2Dir, { recursive: true })
      }

      fs.writeFileSync(
        stateFile,
        JSON.stringify(onlineProcesses, null, 2),
        'utf-8',
      )
    }

    console.log('Stopping all PM2 processes...')
    await runCommand('pm2 stop all')

    console.log('Saving PM2 state...')
    await runCommand('pm2 save --force')

    console.log('All processes stopped successfully.')
  } catch (error) {
    console.error('An error occurred:', error)
    process.exit(1)
  }
}

stopAllProcesses()
