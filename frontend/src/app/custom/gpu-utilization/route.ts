// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import si from 'systeminformation'
import os from 'os'

interface GpuData {
  device: string
  busaddr: string | null
}

function isValidBusAddress(busaddr: string | null): boolean {
  if (!busaddr || typeof busaddr !== 'string') return false
  // Typical PCI bus address: '00:02.0', '3e:00.0', etc.
  return /^([0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.[0-9]$/.test(busaddr)
}

const isWindows = os.platform() === 'win32'
export async function POST(req: Request) {
  const res = await req.json()
  try {
    if (isWindows) {
      const graphicsData = await si.graphics()
      const gpuUtilizations = graphicsData.controllers.map((controller) => ({
        device: controller.model,
        value: controller.utilizationGpu || 0,
      }))
      return NextResponse.json({ gpuUtilizations })
    } else {
      let gpuData: GpuData[] = []
      if (res.gpus && Array.isArray(res.gpus)) {
        gpuData = res.gpus
      } else {
        const graphicsData = await si.graphics()
        gpuData = graphicsData.controllers.map((controller) => ({
          device: controller.model,
          busaddr: controller.busAddress || null,
        }))
      }

      const osInfo = await si.osInfo()
      const osVersion = osInfo.release.split(' ')[0]

      const values = await Promise.all(
        gpuData.map((gpu) => {
          if (gpu.busaddr && isValidBusAddress(gpu.busaddr)) {
            const formattedBusAddress = `pci:slot=0000:${gpu.busaddr}`
            const commandArgs = osVersion.startsWith('24.04')
              ? ['-J', '-p', '-d', formattedBusAddress]
              : ['-J', '-d', formattedBusAddress]

            const process = spawn('intel_gpu_top', commandArgs)
            return getGpuUtilizationLinux(process, osVersion).then((result) => {
              return Promise.resolve({
                device: gpu.device,
                busaddr: gpu.busaddr,
                value: result,
              })
            })
          } else {
            return Promise.resolve({
              device: gpu.device,
              busaddr: gpu.busaddr,
              value: 0,
              error: 'Invalid or missing bus address',
            })
          }
        }),
      )
      return NextResponse.json({
        gpuUtilizations: values.filter((v) => v !== null),
      })
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to do something exceptional'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

function getGpuUtilizationLinux(
  process: ChildProcessWithoutNullStreams,
  osVersion: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false

    process.stderr.on('data', () => {
      if (!resolved) {
        resolved = true
        resolve(0)
        process.kill()
      }
    })

    process.stdout.on('data', (data) => {
      if (resolved) return
      try {
        // Try to find the first '{' and parse from there
        const str = data.toString()
        const jsonStart = str.indexOf('{')
        if (jsonStart === -1) throw new Error('No JSON found')
        const jsonData = JSON.parse(str.slice(jsonStart))
        let utilization = 0

        if (osVersion.startsWith('22.04')) {
          utilization =
            jsonData.engines['[unknown]/0']?.busy ??
            jsonData.engines['Compute/0']?.busy ??
            jsonData.engines['Render/3D/0']?.busy ??
            0
        } else {
          utilization =
            jsonData.engines['Compute/0']?.busy ??
            jsonData.engines['Render/3D/0']?.busy ??
            0
        }

        resolved = true
        resolve(utilization)
        process.kill()
      } catch (error) {
        if (!resolved) {
          resolved = true
          reject(error)
          process.kill()
        }
      }
    })

    process.on('error', (error) => {
      if (!resolved) {
        resolved = true
        reject(error)
        process.kill()
      }
    })

    process.on('close', () => {
      if (!resolved) {
        resolved = true
        resolve(0)
      }
    })
  })
}
