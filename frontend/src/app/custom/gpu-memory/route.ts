// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import os from 'os'
import si from 'systeminformation'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

interface GpuData {
  device: string
  busaddr: string | null
}

interface DeviceLevelMetric {
  metrics_type: string
  avg?: number
  value?: number
}

const isWindows = os.platform() === 'win32'

export async function POST(req: Request) {
  try {
    const res = await req.json()

    let gpuData: GpuData[] = []
    if (res.gpus && Array.isArray(res.gpus)) {
      gpuData = res.gpus
    } else {
      const graphicsData = await si.graphics()
      gpuData = graphicsData.controllers.map((controller) => ({
        device: controller.model,
        busaddr: `0000:${controller.busAddress}` || null,
      }))
    }

    const values = await Promise.all(
      gpuData.map(async (gpu) => {
        if (gpu.busaddr && isValidBusAddress(gpu.busaddr)) {
          const xpusmiCommand = isWindows
            ? 'C:\\EAST\\Tools\\xpu-smi\\xpu-smi.exe'
            : 'xpumcli'
          const process = spawn(xpusmiCommand, [
            'stats',
            '-d',
            gpu.busaddr,
            '-j',
          ])
          return getMemoryUtilization(process).then((value) => ({
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

function isValidBusAddress(busaddr: string | null): boolean {
  if (!busaddr || typeof busaddr !== 'string') return false
  return /^([0-9a-fA-F]{4}:)?([0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.[0-9]$/.test(
    busaddr,
  )
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
