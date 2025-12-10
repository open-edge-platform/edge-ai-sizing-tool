// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { NOT_AVAILABLE } from '@/lib/constants'
import { TextToImagePerformanceMetrics } from '@/types/text2img-types'
import { TextGenerationPerformanceMetrics } from '@/types/textgen-types'
import { AudioPerformanceMetrics } from '@/types/audio-types'
import { DlStreamerPerformanceMetrics } from '@/types/dlstreamer-types'
import { TtsPerformanceMetrics } from '@/types/text2speech-types'
import {
  useCpuUtilization,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
  useGpuMemory,
  useGPUXpum,
} from '@/hooks/useSystemMonitoring'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { GpuMemoryUtilization, GpuUtilization } from '@/types/gpu-types'
import * as XLSX from 'xlsx-js-style'

interface SystemInfoOverview {
  platform: string
  distro: string
  osRelease: string
  architecture: string
  hostname: string
  kernel: string
  timezone: string
  totalMemory: string
  usedMemory: string
  freeMemory: string
  totalDiskSize: string
  usedDiskSize: string
  freeDiskSize: string
  upTime: string
}

interface SystemInfoCPU {
  model: string
  physicalCores: number
  threads: number
  minSpeed: string
  maxSpeed: string
  temperature: number
}

interface SystemInfoGPU {
  device: string
  id: string
  name: string
}

interface SystemInfoNPU {
  model: string
}

interface SystemInfo {
  overview: SystemInfoOverview
  cpu: SystemInfoCPU
  gpus: SystemInfoGPU[]
  npu: SystemInfoNPU
}

interface UtilizationInfo {
  cpuUtilization: Array<{ time: string; cpuUsage: number }>
  memoryUtilization: Array<{ time: string; memoryUsage: number; total: number }>
  gpuUtilization: Record<string, Array<{ time: string; gpuUsage: number }>>
  gpuMemoryUtilization: Record<
    string,
    Array<{ time: string; gpuMemoryUsage: number }>
  >
  npuUtilization: Array<{ time: string; npuUsage: number }>
}

interface WorkloadInfo {
  id: number
  name: string
  model: string
  devices: Array<{ device: string; id: string }>
  performanceMetrics:
    | TextToImagePerformanceMetrics
    | TextGenerationPerformanceMetrics
    | AudioPerformanceMetrics
    | DlStreamerPerformanceMetrics
    | TtsPerformanceMetrics
    | null
}

// Custom hook for utilization
export const useTrimmedUtilization = () => {
  const { data: XpumData } = useGPUXpum()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(XpumData?.gpus || [])
  const npuData = useNpuUtilization()
  const gpuMemoryData = useGpuMemory(XpumData?.gpus || [])

  const [cpuChartData, setCpuChartData] = useState<
    { time: string; cpuUsage: number }[]
  >([])
  const [memoryChartData, setMemoryChartData] = useState<
    { time: string; memoryUsage: number; total: number }[]
  >([])
  const [gpuChartData, setGpuChartData] = useState<
    Record<string, { time: string; gpuUsage: number }[]>
  >({})
  const [gpuMemoryChartData, setGpuMemoryChartData] = useState<
    Record<string, { time: string; gpuMemoryUsage: number }[]>
  >({})
  const [npuChartData, setNpuChartData] = useState<
    { time: string; npuUsage: number }[]
  >([])

  useEffect(() => {
    try {
      if (cpuData.data) {
        setCpuChartData((prevData) => {
          const newData = [
            ...prevData,
            {
              time: new Date().toLocaleTimeString(),
              cpuUsage: cpuData.data.cpuUsage,
            },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update CPU chart data:', err)
    }

    try {
      if (memoryData.data) {
        setMemoryChartData((prevData) => {
          const newData = [
            ...prevData,
            {
              time: new Date().toLocaleTimeString(),
              memoryUsage: memoryData.data.usedPercentage,
              total: memoryData.data.total,
            },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update memory chart data:', err)
    }

    try {
      if (gpuData.data?.gpuUtilizations) {
        gpuData.data.gpuUtilizations.forEach((gpu: GpuUtilization) => {
          if (gpu.device) {
            const deviceId = gpu.device ? gpu.device : ''

            setGpuChartData((prevData) => {
              // Get existing data for this GPU or initialize empty array
              const existingGpuData = prevData[deviceId] || []

              const newData = [
                ...existingGpuData,
                {
                  time: new Date().toLocaleTimeString(),
                  gpuUsage: gpu.compute_usage ?? 0,
                },
              ]

              const trimmedData =
                newData.length > 10
                  ? newData.slice(newData.length - 10)
                  : newData

              // Return updated object with this GPU's data
              return {
                ...prevData,
                [deviceId]: trimmedData,
              }
            })
          }
        })
      }
    } catch (err) {
      console.error('Failed to update GPU chart data:', err)
    }

    try {
      if (gpuMemoryData.data?.gpuMemory) {
        gpuMemoryData.data.gpuMemory.forEach((gpu: GpuMemoryUtilization) => {
          if (gpu.device) {
            const deviceId = gpu.device ? gpu.device : ''

            setGpuMemoryChartData((prevData) => {
              const existingGpuData = prevData[deviceId] || []

              const newData = [
                ...existingGpuData,
                {
                  time: new Date().toLocaleTimeString(),
                  gpuMemoryUsage: gpu.vram_usage ?? 0,
                },
              ]

              const trimmedData =
                newData.length > 10
                  ? newData.slice(newData.length - 10)
                  : newData

              return {
                ...prevData,
                [deviceId]: trimmedData,
              }
            })
          }
        })
      }
    } catch (err) {
      console.error('Failed to update GPU memory chart data:', err)
    }

    try {
      if (npuData.data && npuData.data.name !== NOT_AVAILABLE) {
        setNpuChartData((prevData) => {
          const newData = [
            ...prevData,
            {
              time: new Date().toLocaleTimeString(),
              npuUsage: npuData.data.value,
            },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update NPU chart data:', err)
    }
  }, [
    cpuData.data,
    memoryData.data,
    gpuData.data,
    gpuMemoryData.data,
    npuData.data,
  ])

  const utilizationInfo = {
    cpuUtilization: cpuChartData,
    memoryUtilization: memoryChartData,
    gpuUtilization: gpuChartData,
    gpuMemoryUtilization: gpuMemoryChartData,
    npuUtilization: npuChartData,
  }

  return { utilizationInfo }
}

export const useProcessedSystemInfo = () => {
  const { data, isLoading, error } = useSystemInfo()
  const memoryData = useMemoryUtilization()

  function displayManufacturerBrand(manufacturer: string, brand: string) {
    if (manufacturer === NOT_AVAILABLE && brand === NOT_AVAILABLE)
      return NOT_AVAILABLE
    if (manufacturer === NOT_AVAILABLE) return brand
    if (brand === NOT_AVAILABLE) return manufacturer
    return `${manufacturer} ${brand}`
  }

  if (isLoading || error || !data) {
    return { sysInfo: null }
  }

  const sysInfo = {
    overview: {
      platform: data.os.platform,
      distro: data.os.distro,
      osRelease: data.os.release,
      architecture: data.os.arc,
      hostname: data.os.hostname,
      kernel: data.os.kernelVersion,
      timezone: `${data.os.timezone} (${data.os.timezoneName})`,
      totalMemory:
        memoryData.data && memoryData.data.total !== NOT_AVAILABLE
          ? `${memoryData.data.total.toFixed(0)} GB`
          : (memoryData.data?.total ?? NOT_AVAILABLE),
      usedMemory:
        memoryData.data && memoryData.data.used !== NOT_AVAILABLE
          ? `${memoryData.data.used.toFixed(1)} GB (${memoryData.data.usedPercentage.toFixed(0)}%)`
          : memoryData.data.used,
      freeMemory:
        memoryData.data && memoryData.data.free !== NOT_AVAILABLE
          ? `${memoryData.data.free.toFixed(1)} GB (${memoryData.data.freePercentage.toFixed(0)}%)`
          : memoryData.data.free,
      totalDiskSize:
        data.disk && data.disk?.total !== NOT_AVAILABLE
          ? `${data.disk.total.toFixed(0)} GB`
          : data.disk.total,
      usedDiskSize:
        data.disk && data.disk?.used !== NOT_AVAILABLE
          ? `${data.disk.used.toFixed(0)} GB (${data.disk.usedPercentage.toFixed(0)}%)`
          : data.disk.used,
      freeDiskSize:
        data.disk && data.disk?.free !== NOT_AVAILABLE
          ? `${data.disk.free.toFixed(0)} GB (${data.disk.freePercentage.toFixed(0)}%)`
          : data.disk.free,
      upTime: data.os.uptime,
    },
    cpu: {
      model: displayManufacturerBrand(data.cpu.manufacturer, data.cpu.brand),
      physicalCores:
        data.cpu && data.cpu?.physicalCores !== undefined
          ? data.cpu.physicalCores
          : NOT_AVAILABLE,
      threads:
        data.cpu && data.cpu?.threads !== undefined
          ? data.cpu.threads
          : NOT_AVAILABLE,
      minSpeed:
        data.cpu && data.cpu?.cpuSpeedMin !== NOT_AVAILABLE
          ? `${data.cpu.cpuSpeedMin} GHz`
          : data.cpu.cpuSpeedMin,
      maxSpeed:
        data.cpu && data.cpu?.cpuSpeedMax !== NOT_AVAILABLE
          ? `${data.cpu.cpuSpeedMax} GHz`
          : data.cpu.cpuSpeedMax,
      temperature:
        data.cpu &&
        data.cpu?.temperature !== NOT_AVAILABLE &&
        data.cpu.temperature,
    },
    gpus:
      data.gpuInfo && data.gpuInfo.length > 0
        ? data.gpuInfo
        : 'There are no available GPU devices...',
    npu: {
      model: data.npu && data.npu !== NOT_AVAILABLE && data.npu,
    },
  }

  return { sysInfo }
}

export function exportToExcel(
  systemInfo: SystemInfo,
  utilizationInfo: UtilizationInfo,
  workloadInfo: WorkloadInfo,
) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()
  // Initialize empty array of arrays
  const aoa: (string | number)[][] = []
  // Track which rows are headers (for styling later)
  const headerRows: number[] = []

  // ============ System Information ============
  const systemInfoData = [
    ['System Information'],
    ['Platform', systemInfo.overview.platform],
    ['Distro', systemInfo.overview.distro],
    ['OS Release', systemInfo.overview.osRelease],
    ['Architecture', systemInfo.overview.architecture],
    ['Hostname', systemInfo.overview.hostname],
    ['Kernel', systemInfo.overview.kernel],
    ['Timezone', systemInfo.overview.timezone],
    ['Total Memory', systemInfo.overview.totalMemory],
    ['Used Memory', systemInfo.overview.usedMemory],
    ['Free Memory', systemInfo.overview.freeMemory],
    ['Total Disk Size', systemInfo.overview.totalDiskSize],
    ['Used Disk Size', systemInfo.overview.usedDiskSize],
    ['Free Disk Size', systemInfo.overview.freeDiskSize],
    ['Up Time', systemInfo.overview.upTime],
    ['CPU Information'],
    ['CPU Model', systemInfo.cpu.model],
    ['Physical Cores', systemInfo.cpu.physicalCores],
    ['Logical Cores', systemInfo.cpu.threads],
    ['Min Speed', systemInfo.cpu.minSpeed],
    ['Max Speed', systemInfo.cpu.maxSpeed],
    ['Temperature (°C)', systemInfo.cpu.temperature],
    ['GPU Information'],
    ...systemInfo.gpus.flatMap((gpu, index) => [
      [`Model_${index}`, gpu.name],
      [`Device_${index}`, gpu.device],
    ]),
    ['NPU Information'],
    ['Model', systemInfo.npu.model],
  ]

  aoa.push(...systemInfoData)

  // ============ CPU Utilization ============
  if (utilizationInfo.cpuUtilization.length > 0) {
    const cpuData = [
      ['Time', 'CPU Usage (%)'],
      ...utilizationInfo.cpuUtilization.map((item) => [
        item.time,
        item.cpuUsage,
      ]),
    ]
    aoa.push(...cpuData)
  }

  // ============ Memory Utilization ============
  if (utilizationInfo.memoryUtilization.length > 0) {
    const memoryData = [
      ['Time', 'Memory Usage (%)'],
      ...utilizationInfo.memoryUtilization.map((item) => [
        item.time,
        item.memoryUsage,
      ]),
    ]
    aoa.push(...memoryData)
  }

  // ============ GPU Utilization ============
  Object.entries(utilizationInfo.gpuUtilization).forEach(([deviceId, data]) => {
    if (data.length > 0) {
      const gpuData = [
        ['Time', `GPU Usage (%) [${deviceId}]`],
        ...data.map((item) => [item.time, item.gpuUsage]),
      ]
      aoa.push(...gpuData)
    }
  })

  // ============ GPU Memory Utilization ============
  Object.entries(utilizationInfo.gpuMemoryUtilization).forEach(
    ([deviceId, data]) => {
      if (data.length > 0) {
        const gpuMemData = [
          ['Time', `GPU Memory Usage (%) [${deviceId}]`],
          ...data.map((item) => [item.time, item.gpuMemoryUsage]),
        ]
        aoa.push(...gpuMemData)
      }
    },
  )

  // ============ NPU Utilization ============
  if (utilizationInfo.npuUtilization.length > 0) {
    const npuData = [
      ['Time', 'NPU Usage (%)'],
      ...utilizationInfo.npuUtilization.map((item) => [
        item.time,
        item.npuUsage,
      ]),
    ]
    aoa.push(...npuData)
  }

  // ============ Workload Information ============
  const workloadInfoData = [
    ['Workload Information'],
    ['Name', workloadInfo.name],
    ['Model', workloadInfo.model],
    [
      'Allocated Devices',
      workloadInfo.devices.map((device) => device.device).join(', '),
    ],
    ['Performance Metrics'],
  ]

  // Add performance metrics if available
  if (workloadInfo.performanceMetrics) {
    Object.entries(workloadInfo.performanceMetrics).forEach(([key, value]) => {
      if (key === 'generation_time_s') {
        workloadInfoData.push(['Generation Time (s)', String(value)])
      } else if (key === 'load_time_s') {
        workloadInfoData.push(['Load Time (s)', String(value)])
      } else if (key === 'time_to_token_s') {
        workloadInfoData.push(['Time to Token (s)', String(value)])
      } else if (key === 'throughput_s') {
        workloadInfoData.push(['Throughput (inferences/sec)', String(value)])
      } else if (key === 'total_fps') {
        workloadInfoData.push(['Total FPS', String(value)])
      } else if (key === 'average_fps_per_stream') {
        workloadInfoData.push(['Average FPS (per stream)', String(value)])
      } else {
        workloadInfoData.push([key, String(value)])
      }
    })
  }
  aoa.push(...workloadInfoData)

  // Get header row indices
  aoa.forEach((row, index) => {
    if (row.length < 2) {
      headerRows.push(index)
    } else if (typeof row[0] === 'string' && row[0] === 'Time') {
      headerRows.push(index)
    }
  })

  // Create sheet from data
  const sheet = XLSX.utils.aoa_to_sheet(aoa)

  // ============ AUTO-SIZE COLUMNS ============
  // Calculate max width for each column
  const maxWidths: number[] = []

  aoa.forEach((row) => {
    row.forEach((cell, colIndex) => {
      const cellValue = cell?.toString() || ''
      const cellWidth = cellValue.length

      if (!maxWidths[colIndex] || cellWidth > maxWidths[colIndex]) {
        maxWidths[colIndex] = cellWidth
      }
    })
  })

  // Set column widths (with characters padding)
  const padding = 0
  sheet['!cols'] = maxWidths.map((width) => ({
    wch: Math.min(width + padding, 60), // Cap at 60 characters max
  }))

  // ============ APPLY HEADER STYLING ============
  // Define header style with background color #0071C5
  const headerStyle = {
    fill: {
      patternType: 'solid',
      fgColor: { rgb: '0071C5' },
    },
    alignment: {
      horizontal: 'left',
      vertical: 'center',
    },
  }

  // Apply style to first 2 columns of each header row
  headerRows.forEach((rowIndex) => {
    // Apply to first 2 columns (indices 0 and 1) regardless of value
    for (let colIndex = 0; colIndex < 2; colIndex++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      // Create cell if it doesn't exist
      if (!sheet[cellAddress]) {
        sheet[cellAddress] = { v: '', t: 's' }
      }
      sheet[cellAddress].s = headerStyle
    }
  })

  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')

  // ============ Download the file ============
  const fileName = `workload-ID(${workloadInfo.id})-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
