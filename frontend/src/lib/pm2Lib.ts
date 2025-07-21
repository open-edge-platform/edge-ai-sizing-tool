// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { exec } from 'child_process'
import path from 'path'
import os from 'os'

// Determine the platform
const isWindows = os.platform() === 'win32'

// Function to start a PM2 process using child_process
export async function startPm2Process(
  pm2Name: string,
  scriptName: string,
  params: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Basic sanitization to prevent command injection
    pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
    scriptName = scriptName?.replace(/[^\w.@\-\/ \-]/g, '') || ''
    params = params?.replace(/[^\w.@\-\/\\ :,]/g, '') || ''

    if (!scriptName && !params) {
      const command = `npx pm2 start ${pm2Name}`

      console.log(command)

      exec(
        command,
        { shell: isWindows ? 'cmd.exe' : '/bin/sh' },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing PM2 command: ${error.message}`)
            reject(error)
            return
          }
          if (stderr) {
            console.error(`PM2 stderr: ${stderr}`)
            reject(new Error(stderr))
            return
          }
          console.log(`PM2 stdout: ${stdout}`)
          resolve()
        },
      )
      return
    }

    const scriptFolder = path.resolve(
      path.dirname(''),
      '../workers',
      scriptName.replace(/\s+/g, '-'),
    )

    // Construct the path to the Python interpreter in the virtual environment
    const virtualEnvPath = isWindows
      ? path.join(scriptFolder, 'venv', 'Scripts', 'python.exe')
      : path.join(scriptFolder, 'venv', 'bin', 'python')

    // Construct the PM2 start command
    const scriptPath = path.join(scriptFolder, 'main.py')

    exec(
      `npx pm2 prettylist`,
      { shell: isWindows ? 'cmd.exe' : '/bin/sh' },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error listing PM2 processes: ${error.message}`)
          reject(error)
          return
        }
        if (stderr) {
          console.error(`PM2 list stderr: ${stderr}`)
          reject(new Error(stderr))
          return
        }

        // Construct the PM2 command based on whether the process exists
        const command = `npx pm2 start ${scriptPath} --name ${pm2Name} --interpreter=${virtualEnvPath} -- ${params}`

        console.log(command)

        // Execute the command
        exec(
          command,
          { shell: isWindows ? 'cmd.exe' : '/bin/sh' },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing PM2 command: ${error.message}`)
              reject(error)
              return
            }
            if (stderr) {
              console.error(`PM2 stderr: ${stderr}`)
              reject(new Error(stderr))
              return
            }
            console.log(`PM2 stdout: ${stdout}`)
            resolve()
          },
        )
      },
    )
  })
}

export async function stopPm2Process(pm2Name: string): Promise<void> {
  pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  const command = `npx pm2 stop ${pm2Name}`
  return new Promise((resolve, reject) => {
    exec(
      command,
      { shell: isWindows ? 'cmd.exe' : '/bin/sh' },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error stopping PM2 process: ${error.message}`)
          reject(error)
          return
        }
        if (stderr) {
          console.error(`PM2 stderr: ${stderr}`)
          reject(new Error(stderr))
          return
        }
        console.log(`PM2 stdout: ${stdout}`)
        resolve()
      },
    )
  })
}

export async function deletePm2Process(pm2Name: string): Promise<void> {
  pm2Name = pm2Name?.replace(/[^\w.@\-\/ \-]/g, '') || ''
  const command = `npx pm2 delete ${pm2Name}`
  return new Promise((resolve, reject) => {
    exec(
      command,
      { shell: isWindows ? 'cmd.exe' : '/bin/sh' },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error deleting PM2 process: ${error.message}`)
          reject(error)
          return
        }
        if (stderr) {
          console.error(`PM2 stderr: ${stderr}`)
          reject(new Error(stderr))
          return
        }
        console.log(`PM2 stdout: ${stdout}`)
        resolve()
      },
    )
  })
}
