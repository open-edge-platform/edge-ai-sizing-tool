// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const isWindows = process.platform === 'win32'
    console.log(
      '[Devices API] Detected platform:',
      isWindows ? 'Windows' : 'Linux',
    )

    if (isWindows) {
      // Windows: Use WMI to enumerate video capture devices
      const command = `powershell -NoProfile -Command "& { Get-CimInstance Win32_PnPEntity | Where-Object { ($_.PNPClass -eq 'Camera' -or $_.PNPClass -eq 'Image') -and $_.Status -eq 'OK' } | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress }"`

      console.log('[Devices API] Executing command:', command)

      const { stdout, stderr } = await execAsync(command)

      console.log('[Devices API] stdout:', stdout)
      console.log('[Devices API] stderr:', stderr)

      let deviceNames: string[] = []
      try {
        const parsed = JSON.parse(stdout.trim())
        console.log('[Devices API] Parsed JSON:', parsed)
        deviceNames = Array.isArray(parsed) ? parsed : [parsed]
      } catch (parseError) {
        console.error('[Devices API] JSON parse error:', parseError)
        deviceNames = []
      }

      const devices: { [key: string]: number } = {}
      deviceNames.forEach((name, index) => {
        if (name && name.trim()) {
          devices[name.trim()] = index
        }
      })

      console.log('[Devices API] Final devices object:', devices)

      return new Response(JSON.stringify({ devices }), { status: 200 })
    } else {
      // Linux: Use v4l2-ctl to enumerate video devices
      const { stdout } = await execAsync('v4l2-ctl --list-devices')
      const lines = stdout.split('\n').filter((line) => line.trim() !== '')

      const devices: { [key: string]: number } = {}
      let currentDeviceName = ''
      let index = 0

      for (const line of lines) {
        if (!line.startsWith('\t')) {
          // Device name line
          currentDeviceName = line.trim()
          devices[currentDeviceName] = index++
        }
      }

      return new Response(JSON.stringify({ devices }), { status: 200 })
    }
  } catch (err: unknown) {
    console.error('[Devices API] Error executing command:', err)
    if (err instanceof Error) {
      console.error('[Devices API] Error message:', err.message)
      console.error('[Devices API] Error stack:', err.stack)
    }
    return new Response(JSON.stringify({ devices: {} }), { status: 200 })
  }
}
