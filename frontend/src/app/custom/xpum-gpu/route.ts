// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import os from 'os'
import path from 'path'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { GpuData } from '@/types/gpu-types'

const isWindows = os.platform() === 'win32'

export async function GET() {
  let gpuData: GpuData[] = []

  try {
    await new Promise((resolve, reject) => {
      const xpusmiCommand = isWindows
        ? path.join(process.cwd(), '..', 'thirdparty', 'xpu-smi', 'xpu-smi.exe')
        : 'xpumcli'
      const childProcess: ChildProcessWithoutNullStreams = spawn(
        xpusmiCommand,
        ['discovery', '-j'],
      )

      childProcess.stderr.on('data', () => {
        resolve([])
        childProcess.kill()
      })

      childProcess.stdout.on('data', (data: Buffer) => {
        if (data) {
          const jsonData = JSON.parse(data.toString())
          gpuData = jsonData.device_list.map(
            (device: { device_name: string; pci_bdf_address: string }) => ({
              device: device.device_name,
              busaddr: device.pci_bdf_address,
            }),
          )
          resolve(gpuData)
          childProcess.kill()
        }
      })

      childProcess.on('error', (error: Error) => {
        console.error('Error executing gpu_memory script:', error)
        reject(error)
        childProcess.kill()
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
