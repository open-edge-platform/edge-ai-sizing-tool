// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { exec } from 'child_process'
import path from 'path'
import os from 'os'
import { promisify } from 'util'

// Determine the platform
const isWindows = os.platform() === 'win32'

//convert exec (callback-based function) into a function that returns a Promise
const execAsync = promisify(exec)
async function runCommand(command: string): Promise<string> {
  try {
    console.log(`Executing: ${command}`)
    const { stdout, stderr } = await execAsync(command, {
      shell: isWindows ? 'cmd.exe' : '/bin/sh',
    })

    if (stdout) {
      console.log(`PM2 stdout: ${stdout}`)
    }

    if (stderr) {
      console.log(`PM2 stderr: ${stderr}`)
    }
    return stdout
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error executing command "${command}": ${err.message}`)
    } else {
      console.error(`Error executing command "${command}": ${String(err)}`)
    }
    throw err
  }
}

// Function to start a PM2 process using child_process
export async function startPm2Process(
  pm2Name: string,
  scriptName: string,
  params: string,
): Promise<void> {
  // Basic sanitization to prevent command injection
  pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  scriptName = scriptName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  params = params?.replace(/[^\w.@\-\/\\ :,]/g, '') || ''

  if (!scriptName && !params) {
    await runCommand(`npx pm2 start ${pm2Name}`)
    return
  }

  const scriptFolder = path.resolve(
    path.dirname(''),
    '../workers',
    scriptName.replace(/\s+/g, '-'),
  )

  // Construct the path to the Python interpreter in the virtual environment
  const virtualEnvPath = isWindows
    ? path.join(scriptFolder, 'venv', 'Scripts', 'pythonw.exe')
    : path.join(scriptFolder, 'venv', 'bin', 'python')

  // Construct the PM2 start command
  const scriptPath = path.join(scriptFolder, 'main.py')

  try {
    await runCommand(
      `npx pm2 start ${scriptPath} --name ${pm2Name} --interpreter=${virtualEnvPath} --no-autorestart -- ${params}`,
    )
  } catch (err) {
    throw err
  }
}

export async function stopPm2Process(pm2Name: string): Promise<void> {
  pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  await runCommand(`npx pm2 stop ${pm2Name}`)
}

export async function deletePm2Process(pm2Name: string): Promise<void> {
  pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  await runCommand(`npx pm2 delete ${pm2Name}`)
}
