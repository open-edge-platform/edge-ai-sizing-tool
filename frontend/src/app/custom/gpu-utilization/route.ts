// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import os from 'os'
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
          const xpusmiCommand = isWindows
            ? 'C:\\EAST\\Tools\\xpu-smi\\xpu-smi.exe'
            : 'xpumcli'
          const process = spawn(xpusmiCommand, [
            'stats',
            '-d',
            gpu.busaddr,
            '-j',
          ])
          return getGpuUtilization(process).then((value) => ({
            device: gpu.device,
            busaddr: gpu.busaddr,
            compute_usage: value,
          }))
        } else {
          return Promise.resolve({
            device: gpu.device,
            busaddr: gpu.busaddr,
            compute_usage: 0,
            error: 'Invalid or missing bus address',
          })
        }
      }),
    )
    return NextResponse.json({
      gpuUtilizations: values.filter((v) => v.compute_usage !== null),
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to do something exceptional'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

function getGpuUtilization(
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
        let gpu_usage: number | null = null

        if (jsonData.device_level && Array.isArray(jsonData.device_level)) {
          const computeUtilMetric = jsonData.device_level.find(
            (metric: DeviceLevelMetric) =>
              metric.metrics_type ===
              'XPUM_STATS_ENGINE_GROUP_COMPUTE_ALL_UTILIZATION',
          )

          if (computeUtilMetric) {
            gpu_usage = isWindows
              ? computeUtilMetric.value
              : computeUtilMetric.avg
          } else {
            const renderUtilMetric = jsonData.device_level.find(
              (metric: DeviceLevelMetric) =>
                metric.metrics_type ===
                'XPUM_STATS_ENGINE_GROUP_RENDER_ALL_UTILIZATION',
            )
            if (renderUtilMetric) {
              gpu_usage = isWindows
                ? renderUtilMetric.value
                : renderUtilMetric.avg
            } else {
              gpu_usage = null
            }
          }
        }

        resolve(gpu_usage)
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
