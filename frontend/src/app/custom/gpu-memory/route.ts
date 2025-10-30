// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import os from 'os'
import path from 'path'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { GpuData, DeviceLevelMetric } from '@/types/gpu-types'
import { isValidBusAddress } from '@/lib/utils'

const isWindows = os.platform() === 'win32'

export async function POST(req: Request) {
  try {
    const res = await req.json()

    let gpuData: GpuData[] = []
    if (res.gpus && Array.isArray(res.gpus)) {
      gpuData = res.gpus
    }

    const values = await Promise.all(
      gpuData.map(async (gpu) => {
        if (gpu.busaddr && isValidBusAddress(gpu.busaddr)) {
          // Resolve xpu-smi.exe relative to the repo root for Windows
          const xpusmiCommand: string = isWindows
            ? path.join(
                process.cwd(),
                '..',
                'thirdparty',
                'xpu-smi',
                'xpu-smi.exe',
              )
            : 'xpumcli'
          const spawnedProcess = spawn(xpusmiCommand, [
            'stats',
            '-d',
            gpu.busaddr,
            '-j',
          ])
          return getMemoryUtilization(spawnedProcess).then((value) => ({
            device: gpu.device,
            busaddr: gpu.busaddr,
            vram_usage: value,
          }))
        } else {
          return Promise.resolve({
            device: gpu.device,
            busaddr: gpu.busaddr,
            vram_usage: 0,
            error: 'Invalid or missing bus address',
          })
        }
      }),
    )
    return NextResponse.json({
      gpuMemory: values.filter((v) => v.vram_usage !== null),
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve GPU data using XPU Manager.'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

function getMemoryUtilization(
  process: ChildProcessWithoutNullStreams,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    process.stderr.on('data', () => {
      resolve(0)
      process.kill()
    })

    process.stdout.on('data', (data) => {
      try {
        const jsonData = JSON.parse(data.toString())
        let memory_usage: number | null = null

        if (jsonData.device_level && Array.isArray(jsonData.device_level)) {
          const memoryUtilMetric = jsonData.device_level.find(
            (metric: DeviceLevelMetric) =>
              metric.metrics_type === 'XPUM_STATS_MEMORY_UTILIZATION',
          )
          if (memoryUtilMetric) {
            memory_usage = isWindows
              ? memoryUtilMetric.value
              : memoryUtilMetric.avg
          } else {
            memory_usage = null // No memory utilization for integrated GPU
          }
        }

        resolve(memory_usage)
        process.kill()
      } catch (error) {
        reject(error)
        process.kill()
      }
    })

    process.on('error', (error) => {
      reject(error)
      process.kill()
    })

    process.on('close', () => {
      resolve(0)
    })
  })
}
