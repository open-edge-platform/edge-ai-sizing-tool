// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import { addon as ov } from 'openvino-node'
import { NOT_AVAILABLE } from '@/lib/constants'
import { spawn } from 'child_process'
import os from 'os'

const isWindows = os.platform() === 'win32'

export async function GET() {
  const core = new ov.Core()
  const available_devices = core.getAvailableDevices()
  const npuUtilization = { name: NOT_AVAILABLE, value: null as number | null }

  for (const device of available_devices) {
    if (device.startsWith('NPU')) {
      npuUtilization.name = String(core.getProperty(device, 'FULL_DEVICE_NAME'))
    }
  }

  if (npuUtilization.name !== NOT_AVAILABLE) {
    if (isWindows) {
      return NextResponse.json({
        name: NOT_AVAILABLE,
        value: null,
      })
    } else {
      try {
        await new Promise((resolve, reject) => {
          const process = spawn('../scripts/npu_top.sh')

          process.stderr.on('data', () => {
            npuUtilization.value = null
            resolve(0)
            process.kill()
          })

          process.stdout.on('data', (data) => {
            if (data) {
              npuUtilization.value = Number(data.toString())
              resolve(npuUtilization)
              process.kill()
            }
          })

          process.on('error', (error) => {
            console.error('Error executing npu_top script:', error)
            reject(error)
            process.kill()
          })
        })
        return NextResponse.json({
          name: npuUtilization.name,
          value: npuUtilization.value,
        })
      } catch (error) {
        let errorMessage = 'Failed to do something exceptional'
        if (error instanceof Error) {
          errorMessage = error.message
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
      }
    }
  } else {
    return NextResponse.json({
      name: NOT_AVAILABLE,
      value: null,
    })
  }
}
