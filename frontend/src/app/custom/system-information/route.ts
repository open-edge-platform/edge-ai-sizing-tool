// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import si from 'systeminformation'
import { addon as ov } from 'openvino-node'
import { NOT_AVAILABLE } from '@/lib/constants'

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

function bytesToGigabytes(bytes: number) {
  const gigabytes = bytes / 1024 ** 3
  return Math.round(gigabytes * 10) / 10
}

function calculatePercentage(num: number, total: number): number {
  if (total === 0) return 0
  return Math.round((num / total) * 1000) / 10
}

export async function GET() {
  try {
    const memInfo = await si.mem()
    const osInfo = await si.osInfo()
    const cpuInfo = await si.cpu()
    const cpuTemp = await si.cpuTemperature()
    const fsInfo = await si.fsSize()
    const disk = fsInfo[0]

    const memory =
      typeof memInfo.total === 'number'
        ? bytesToGigabytes(memInfo.total)
        : NOT_AVAILABLE
    const freeMemory =
      typeof memInfo.free === 'number'
        ? bytesToGigabytes(memInfo.free)
        : NOT_AVAILABLE
    const freeMemoryPercentage =
      typeof memory === 'number' && typeof freeMemory === 'number'
        ? calculatePercentage(freeMemory, memory)
        : NOT_AVAILABLE
    const usedMemory =
      typeof memory === 'number' && typeof freeMemory === 'number'
        ? Math.round((memory - freeMemory) * 10) / 10
        : NOT_AVAILABLE
    const usedMemoryPercentage =
      typeof usedMemory === 'number' && typeof memory === 'number'
        ? calculatePercentage(usedMemory, memory)
        : NOT_AVAILABLE

    const freeDisk =
      typeof disk.available === 'number'
        ? bytesToGigabytes(disk.available)
        : NOT_AVAILABLE
    const totalDisk =
      typeof disk.size === 'number'
        ? bytesToGigabytes(disk.size)
        : NOT_AVAILABLE
    const usedDisk =
      typeof disk.used === 'number'
        ? bytesToGigabytes(disk.used)
        : NOT_AVAILABLE
    const freeDiskPercentage =
      typeof freeDisk === 'number' && typeof totalDisk === 'number'
        ? calculatePercentage(freeDisk, totalDisk)
        : NOT_AVAILABLE
    const usedDiskPercentage =
      typeof usedDisk === 'number' && typeof totalDisk === 'number'
        ? calculatePercentage(usedDisk, totalDisk)
        : NOT_AVAILABLE

    return NextResponse.json({
      platform: osInfo.platform ?? NOT_AVAILABLE,
      osRelease: osInfo.release ?? NOT_AVAILABLE,
      osArc: osInfo.arch ?? NOT_AVAILABLE,
      osDistro: osInfo.distro ?? NOT_AVAILABLE,
      hostname: osInfo.hostname ?? NOT_AVAILABLE,
      kernelVersion: osInfo.kernel ?? NOT_AVAILABLE,
      memory: {
        total: memory,
        free: freeMemory,
        freePercentage: freeMemoryPercentage,
        used: usedMemory,
        usedPercentage: usedMemoryPercentage,
      },
      disk: {
        total: totalDisk,
        free: freeDisk,
        freePercentage: freeDiskPercentage,
        used: usedDisk,
        usedPercentage: usedDiskPercentage,
      },
      manufacturer: cpuInfo.manufacturer ?? NOT_AVAILABLE,
      brand: cpuInfo.brand ?? NOT_AVAILABLE,
      physicalCores: cpuInfo.physicalCores ?? NOT_AVAILABLE,
      threads: cpuInfo.cores ?? NOT_AVAILABLE,
      cpuSpeed: cpuInfo.speed ?? NOT_AVAILABLE,
      cpuSpeedMin: cpuInfo.speedMin ?? NOT_AVAILABLE,
      cpuSpeedMax: cpuInfo.speedMax ?? NOT_AVAILABLE,
      temperature: cpuTemp.main ?? NOT_AVAILABLE,
      gpuInfo: await getGPUInfo(),
      npu: getNPUInfo() ?? NOT_AVAILABLE,
    })
  } catch (error) {
    console.error('Error fetching system information details:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve system information details' },
      { status: 500 },
    )
  }
}
