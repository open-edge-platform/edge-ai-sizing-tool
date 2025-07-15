// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import { promisify } from 'util'
import { ChildProcessWithoutNullStreams, spawn, exec } from 'child_process'
import si from 'systeminformation'
import os from 'os'

const isWindows = os.platform() === 'win32'

interface GpuData {
  device: string
  busaddr: string | null
}

const deviceCache = {
  clinfo: null as Array<{
    device: string
    uuid: string
    busaddr: string
  }> | null,
  mappings: new Map<string, { device: string; uuid: string | null }>(),
}

let clinfoPromise: Promise<
  Array<{ device: string; uuid: string; busaddr: string }>
> | null = null

async function getDeviceInfoFromClinfo(): Promise<
  Array<{ device: string; uuid: string; busaddr: string }>
> {
  if (deviceCache.clinfo) {
    return deviceCache.clinfo
  }

  if (!clinfoPromise) {
    const execAsync = promisify(exec)
    clinfoPromise = execAsync('clinfo')
      .then(({ stdout }) => {
        const allGPUDevices = []
        const deviceRgx =
          /Device Name\s+(.+?)[\r\n]+(?:[\s\S]*?)Device UUID\s+([0-9a-fA-F-]+)(?:[\s\S]*?)Device PCI bus info \(KHR\)\s+PCI-E,\s+(0000:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9])/gi

        let match
        while ((match = deviceRgx.exec(stdout)) !== null) {
          const deviceName = match[1]?.trim() || 'Unknown Device'
          const uuid = match[2]?.replace(/[^a-fA-F0-9]/g, '') || ''
          const busAddr = match[3]

          allGPUDevices.push({ uuid, device: deviceName, busaddr: busAddr })
        }

        deviceCache.clinfo = allGPUDevices
        return allGPUDevices
      })
      .catch((err) => {
        console.log('Error getting clinfo data', err)
        clinfoPromise = null
        return []
      })
  }

  return clinfoPromise
}

async function mapGPUDeviceName(
  gpuModel: string,
  busAddr?: string | null,
): Promise<{ device: string; uuid: string | null }> {
  const cacheKey = `${gpuModel}:${busAddr || 'null'}`

  if (deviceCache.mappings.has(cacheKey)) {
    return deviceCache.mappings.get(cacheKey)!
  }

  let result: { device: string; uuid: string | null }

  if (busAddr) {
    const formattedBusAddr = busAddr.includes('0000:')
      ? busAddr
      : `0000:${busAddr}`
    const clinfoDevices = await getDeviceInfoFromClinfo()
    const matchByBusAddr = clinfoDevices.find(
      (device) =>
        device.busaddr.toLowerCase() === formattedBusAddr.toLowerCase(),
    )
    if (matchByBusAddr) {
      result = {
        device: matchByBusAddr.device,
        uuid: matchByBusAddr.uuid,
      }
    } else {
      result = { device: gpuModel, uuid: null }
    }
  } else {
    result = { device: gpuModel, uuid: null }
  }
  deviceCache.mappings.set(cacheKey, result)
  return result
}

function isValidBusAddress(busaddr: string | null): boolean {
  if (!busaddr || typeof busaddr !== 'string') return false
  // Typical PCI bus address: '00:02.0', '3e:00.0', etc.
  return /^([0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.[0-9]$/.test(busaddr)
}

export async function POST(req: Request) {
  const res = await req.json()
  try {
    if (isWindows) {
      const graphicsData = await si.graphics()
      const gpuUtilizations = graphicsData.controllers.map((controller) => ({
        device: controller.model,
        busaddr: controller.busAddress,
        uuid: null,
        value: controller.utilizationGpu || 0,
      }))
      return NextResponse.json({ gpuUtilizations })
    } else {
      await getDeviceInfoFromClinfo()
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

      const deviceMappingPromises = gpuData.map((gpu) =>
        mapGPUDeviceName(gpu.device, gpu.busaddr),
      )
      const mappedDevices = await Promise.all(deviceMappingPromises)
      const deviceMap = new Map()
      gpuData.forEach((gpu, idx) => {
        const key = `${gpu.device}:${gpu.busaddr || 'null'}`
        deviceMap.set(key, mappedDevices[idx])
      })

      const osInfo = await si.osInfo()
      const osVersion = osInfo.release.split(' ')[0]

      const values = await Promise.all(
        gpuData.map(async (gpu) => {
          const key = `${gpu.device}:${gpu.busaddr || 'null'}`
          const mappedDevice = deviceMap.get(key)
          if (gpu.busaddr && isValidBusAddress(gpu.busaddr)) {
            const formattedBusAddress = `pci:slot=0000:${gpu.busaddr}`
            const commandArgs = osVersion.startsWith('24.04')
              ? ['-J', '-p', '-d', formattedBusAddress]
              : ['-J', '-d', formattedBusAddress]

            const process = spawn('intel_gpu_top', commandArgs)
            return getGpuUtilizationLinux(process, osVersion).then(
              (result) => ({
                device: mappedDevice.device,
                uuid: mappedDevice.uuid,
                value: result,
              }),
            )
          } else {
            return Promise.resolve({
              device: mappedDevice.device,
              uuid: mappedDevice.uuid,
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

if (!isWindows) {
  getDeviceInfoFromClinfo().catch((err) =>
    console.error('Error pre-loading device cache:', err),
  )
}
