// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import os from 'os'
import { spawn } from 'child_process'

interface GpuData {
  device: string
  busaddr: string | null
}

const isWindows = os.platform() === 'win32'

export async function GET() {
  let gpuData: GpuData[] = []

  try {
    await new Promise((resolve, reject) => {
      const xpusmiCommand = isWindows
        ? 'C:\\EAST\\Tools\\xpu-smi\\xpu-smi.exe'
        : 'xpumcli'
      const process = spawn(xpusmiCommand, ['discovery', '-j'])

      process.stderr.on('data', () => {
        resolve([])
        process.kill()
      })

      process.stdout.on('data', (data) => {
        if (data) {
          const jsonData = JSON.parse(data.toString())
          gpuData = jsonData.device_list.map(
            (device: { device_name: string; pci_bdf_address: string }) => ({
              device: device.device_name,
              busaddr: device.pci_bdf_address,
            }),
          )
          resolve(gpuData)
          process.kill()
        }
      })

      process.on('error', (error) => {
        console.error('Error executing gpu_memory script:', error)
        reject(error)
        process.kill()
      })
    })
    return NextResponse.json({ gpus: gpuData })
  } catch (error) {
    let errorMessage = 'Failed to retrieve GPU data using XPU Manager.'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
