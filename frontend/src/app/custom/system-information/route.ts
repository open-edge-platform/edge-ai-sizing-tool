// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import si from 'systeminformation'
import { addon as ov } from 'openvino-node'
import { NOT_AVAILABLE } from '@/lib/constants'
import { bytesToGigabytes, calculatePercentage } from '@/lib/utils'

function getAvailableDevices() {
  const core = new ov.Core()
  const available_devices = core.getAvailableDevices()
  return { core, available_devices }
}

async function getGPUInfo(): Promise<{ name: string; device: string }[]> {
  const { core, available_devices } = getAvailableDevices()
  let gpus: { name: string; device: string; id: string }[] = []

  for (const available_device of available_devices) {
    if (available_device.startsWith('GPU')) {
      const name = String(
        core.getProperty(available_device, 'FULL_DEVICE_NAME'),
      )
      gpus.push({
        id: available_device,
        name: name,
        device: available_device || NOT_AVAILABLE,
      })
    }
  }
  if (gpus.length > 0) {
    return gpus
  }

  const graphicsData = await si.graphics()
  gpus = graphicsData.controllers.map((controller, id) => ({
    id: controller.busAddress || `${id}`,
    name: controller.model || `GPU ${id}`,
    device: NOT_AVAILABLE,
  }))
  return gpus
}

function getNPUInfo(): string {
  const { core, available_devices } = getAvailableDevices()
  if (available_devices.includes('NPU')) {
    return String(core.getProperty('NPU', 'FULL_DEVICE_NAME'))
  } else {
    return NOT_AVAILABLE
  }
}

function formatUptime(sec: number): string {
  const days = Math.floor(sec / (24 * 3600))
  sec %= 24 * 3600
  const hours = Math.floor(sec / 3600)
  sec %= 3600
  const mins = Math.floor(sec / 60)
  sec = Math.floor(sec % 60)

  let result = ''
  if (days > 0) {
    result += `${days}d `
  }
  if (hours > 0) {
    result += `${hours}h `
  }
  if (mins > 0) {
    result += `${mins}m `
  }
  return result
}

export async function GET() {
  try {
    const [osInfo, systemTime, cpuInfo, cpuTemp, gpuInfo] = await Promise.all([
      si.osInfo(),
      si.time(),
      si.cpu(),
      si.cpuTemperature(),
      getGPUInfo(),
    ])

    const formattedUpTime =
      typeof systemTime.uptime === 'number'
        ? formatUptime(systemTime.uptime)
        : NOT_AVAILABLE
    const fsInfo = await si.fsSize()
    let disk
    if (process.platform === 'win32') {
      disk = fsInfo.find(
        (disk) =>
          disk.mount &&
          (disk.mount.toUpperCase() === 'C:' ||
            disk.mount.toUpperCase() === 'C' ||
            disk.mount.toUpperCase().startsWith('C:\\')),
      )
    } else {
      disk = fsInfo.find((disk) => disk.mount === '/')
    }

    const totalDiskInGigabytes =
      disk && Number.isFinite(disk.size)
        ? bytesToGigabytes(disk.size)
        : NOT_AVAILABLE
    const usedDiskInGigabytes =
      disk && Number.isFinite(disk.used)
        ? bytesToGigabytes(disk.used)
        : NOT_AVAILABLE
    const freeDiskInGigabytes =
      disk && Number.isFinite(disk.size) && Number.isFinite(disk.used)
        ? bytesToGigabytes(disk.size - disk.used)
        : NOT_AVAILABLE

    const freeDiskPercentage =
      typeof freeDiskInGigabytes === 'number' &&
      typeof totalDiskInGigabytes === 'number'
        ? calculatePercentage(freeDiskInGigabytes, totalDiskInGigabytes)
        : NOT_AVAILABLE
    const usedDiskPercentage =
      typeof usedDiskInGigabytes === 'number' &&
      typeof totalDiskInGigabytes === 'number'
        ? calculatePercentage(usedDiskInGigabytes, totalDiskInGigabytes)
        : NOT_AVAILABLE

    return NextResponse.json({
      os: {
        platform: osInfo.platform ?? NOT_AVAILABLE,
        release: osInfo.release ?? NOT_AVAILABLE,
        arc: osInfo.arch ?? NOT_AVAILABLE,
        distro: osInfo.distro ?? NOT_AVAILABLE,
        hostname: osInfo.hostname ?? NOT_AVAILABLE,
        kernelVersion: osInfo.kernel ?? NOT_AVAILABLE,
        timezone: systemTime.timezone ?? NOT_AVAILABLE,
        timezoneName: systemTime.timezoneName ?? NOT_AVAILABLE,
        uptime: formattedUpTime,
      },
      disk: {
        total: totalDiskInGigabytes,
        free: freeDiskInGigabytes,
        used: usedDiskInGigabytes,
        usedPercentage: usedDiskPercentage,
        freePercentage: freeDiskPercentage,
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer ?? NOT_AVAILABLE,
        brand: cpuInfo.brand ?? NOT_AVAILABLE,
        physicalCores: cpuInfo.physicalCores ?? NOT_AVAILABLE,
        threads: cpuInfo.cores ?? NOT_AVAILABLE,
        cpuSpeed: cpuInfo.speed ?? NOT_AVAILABLE,
        cpuSpeedMin: cpuInfo.speedMin ?? NOT_AVAILABLE,
        cpuSpeedMax: cpuInfo.speedMax ?? NOT_AVAILABLE,
        temperature: cpuTemp.main ?? NOT_AVAILABLE,
      },
      gpuInfo,
      npu: getNPUInfo(),
    })
  } catch (error) {
    console.error('Error fetching system information details:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve system information details' },
      { status: 500 },
    )
  }
}
