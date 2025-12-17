// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import {
  CpuIcon,
  HardDrive,
  Search,
  Zap,
  RefreshCw,
  Microchip,
  MemoryStick,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

import { CpuChart } from '@/components/monitor/cpu-chart'
import { MemoryChart } from '@/components/monitor/memory-chart'
import { GpuChart } from '@/components/monitor/gpu-chart'
import { GpuMemoryChart } from './monitor/gpu-memory-chart'
import { NpuChart } from '@/components/monitor/npu-chart'
import { PowerChart } from '@/components/monitor/power-chart'
import { NOT_AVAILABLE } from '@/lib/constants'
import {
  useCpuUtilization,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
  useGpuMemory,
  useGPUXpum,
  usePackagePower,
} from '@/hooks/useSystemMonitoring'
import { ChartItem } from '@/types/chart-types'
import { GpuMemoryUtilization, GpuUtilization } from '@/types/gpu-types'

export function SystemMonitorSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const { setOpen } = useSidebar()

  const { data: xpumData } = useGPUXpum()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(xpumData?.gpus || [])
  const npuData = useNpuUtilization()
  const gpuMemoryData = useGpuMemory(xpumData?.gpus || [])
  const powerData = usePackagePower()

  // Create chart items based on available data
  const chartItems = React.useMemo(() => {
    const items: ChartItem[] = [
      {
        id: 'cpu',
        type: 'cpu',
        title: 'CPU Usage',
        description: 'Processor utilization',
        icon: CpuIcon,
      },
      {
        id: 'memory',
        type: 'memory',
        title: 'Memory Usage',
        description: 'System memory consumption',
        icon: HardDrive,
      },
    ]

    // Add GPU items if available, handle loading state, or handle error
    if (gpuData.isLoading) {
      items.push({
        id: 'gpu-loading',
        type: 'gpu',
        title: 'GPU: Loading',
        description: 'Fetching GPU data...',
        icon: RefreshCw,
        device: 'loading-device',
      })
    } else if (gpuData.error) {
      items.push({
        id: 'gpu-error',
        type: 'gpu',
        title: 'GPU: Error',
        description: 'Failed to fetch GPU data',
        icon: Zap,
        device: 'error-device',
      })
    } else if (gpuData.data) {
      gpuData.data.gpuUtilizations.forEach((gpu: GpuUtilization) => {
        const gpuDisplayName =
          gpu.device.split('[')[1]?.replace(']', '') || gpu.device
        if (gpu.compute_usage !== null) {
          items.push({
            id: gpu.busaddr ? `gpu-${gpu.busaddr}` : `gpu ${gpu.device}`,
            type: 'gpu',
            title: `GPU: ${gpuDisplayName}`,
            description: 'Graphics processor utilization',
            icon: Zap,
            device: gpu.device,
          })
        } else {
          items.push({
            id: gpu.busaddr ? `gpu-${gpu.busaddr}` : `gpu ${gpu.device}`,
            type: 'n/a',
            title: `GPU: ${gpuDisplayName}`,
            description: 'Currently Not Supported',
            icon: Zap,
            device: gpu.device,
          })
        }
      })
    }

    if (gpuMemoryData.isLoading) {
      items.push({
        id: 'gpu-memory-loading',
        type: 'gpu-memory',
        title: 'GPU Memory: Loading',
        description: 'Fetching GPU Memory data...',
        icon: RefreshCw,
        device: 'loading-device',
      })
    } else if (gpuMemoryData.error) {
      items.push({
        id: 'gpu-memory-error',
        type: 'gpu-memory',
        title: 'GPU Memory: Error',
        description: 'Failed to fetch GPU Memory data',
        icon: MemoryStick,
        device: 'error-device',
      })
    } else if (gpuMemoryData.data) {
      gpuMemoryData.data.gpuMemory.forEach((gpu: GpuMemoryUtilization) => {
        const gpuDisplayName =
          gpu.device.split('[')[1]?.replace(']', '') || gpu.device
        items.push({
          id: gpu.busaddr ? `gpu-memory-${gpu.busaddr}` : `gpu ${gpu.device}`,
          type: 'gpu-memory',
          title: `GPU: ${gpuDisplayName}`,
          description: 'Graphics processor memory utilization',
          icon: MemoryStick,
          device: gpu.device,
        })
      })
    }

    if (npuData.isLoading) {
      items.push({
        id: 'npu-loading',
        type: 'npu',
        title: 'NPU: Loading',
        description: 'Fetching NPU data...',
        icon: RefreshCw,
        device: 'loading-device',
      })
    } else if (npuData.error) {
      items.push({
        id: 'npu-error',
        type: 'npu',
        title: 'NPU: Error',
        description: 'Failed to fetch NPU data',
        icon: Zap,
        device: 'error-device',
      })
    } else if (npuData.data && npuData.data.name !== NOT_AVAILABLE) {
      items.push({
        id: 'npu',
        type: npuData.data.value !== null ? 'npu' : 'n/a',
        title: `NPU: ${npuData.data.name}`,
        description: 'Neural processing unit utilization',
        icon: Zap,
        device: npuData.data.name,
      })
    } else if (npuData.data && npuData.data.name == NOT_AVAILABLE) {
      items.push({
        id: 'npu',
        type: 'n/a',
        title: `NPU: ${npuData.data.name}`,
        description: 'Neural processing unit utilization',
        icon: Zap,
        device: npuData.data.name,
      })
    }

    if (powerData.isLoading) {
      items.push({
        id: 'power-loading',
        type: 'power',
        title: 'Power Consumption: Loading',
        description: 'Fetching power data...',
        icon: RefreshCw,
        device: 'loading-device',
      })
    } else if (powerData.error) {
      items.push({
        id: 'power-error',
        type: 'power',
        title: 'Power Consumption: Error',
        description: 'Failed to fetch Power data',
        icon: Zap,
        device: 'error-device',
      })
    } else if (powerData.data) {
      items.push({
        id: 'power',
        type:
          powerData.data.joulesConsumed !== null &&
          !isNaN(powerData.data.joulesConsumed)
            ? 'power'
            : 'n/a',
        title: 'Power Consumption',
        description: 'Power consumption',
        icon: Zap,
        device: 'power-device',
      })
    }
    return items
  }, [
    gpuData.data,
    gpuData.error,
    gpuData.isLoading,
    gpuMemoryData.data,
    gpuMemoryData.error,
    gpuMemoryData.isLoading,
    npuData.data,
    npuData.error,
    npuData.isLoading,
    powerData.data,
    powerData.error,
    powerData.isLoading,
  ])

  // Filter charts based on search term
  const filteredCharts = React.useMemo(() => {
    return chartItems.filter(
      (chart) =>
        chart.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chart.description.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [chartItems, searchTerm])

  return (
    <Sidebar
      collapsible="none"
      data-sidebar="system-monitor"
      className="flex-1"
      {...props}
    >
      <SidebarHeader className="header gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-foreground text-base font-medium">
            System Monitor
          </div>
        </div>
        <div className="search-bar relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <SidebarInput
            placeholder="Search system monitor"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="system-utilization-charts py-3">
        <SidebarMenu className="hide-scrollbar gap-2 overflow-auto">
          {filteredCharts.map((chart) => (
            <SidebarMenuItem
              key={chart.id}
              onClick={() => {
                setOpen(true)
              }}
              className={`my-0.5 h-auto flex-col items-start px-3`}
            >
              {chart.type === 'cpu' && (
                <CpuChart
                  className="chart w-full"
                  compact
                  data-chart-type="cpu"
                  data={cpuData.data}
                  isLoading={cpuData.isLoading}
                  error={cpuData.error}
                  refetch={cpuData.refetch}
                  isRefetching={cpuData.isRefetching}
                />
              )}
              {chart.type === 'memory' && (
                <MemoryChart
                  className="chart w-full"
                  compact
                  data-chart-type="memory"
                  data={memoryData.data}
                  isLoading={memoryData.isLoading}
                  error={memoryData.error}
                  refetch={memoryData.refetch}
                  isRefetching={memoryData.isRefetching}
                />
              )}
              {chart.type === 'gpu' && chart.device && (
                <GpuChart
                  className="chart w-full"
                  compact
                  device={chart.device}
                  value={
                    gpuData.isLoading
                      ? 0
                      : (gpuData.data?.gpuUtilizations.find(
                          (gpu: GpuUtilization) =>
                            `gpu-${gpu.busaddr}` === chart.id,
                        )?.compute_usage ?? 0)
                  }
                  isLoading={gpuData.isLoading}
                  error={chart.id === 'gpu-error' ? gpuData.error : undefined}
                  refetch={gpuData.refetch}
                  isRefetching={gpuData.isRefetching}
                />
              )}
              {chart.type === 'gpu-memory' && chart.device && (
                <GpuMemoryChart
                  className="chart w-full"
                  compact
                  device={chart.device}
                  value={
                    gpuMemoryData.isLoading
                      ? 0
                      : (gpuMemoryData.data?.gpuMemory.find(
                          (gpu: GpuMemoryUtilization) =>
                            `gpu-memory-${gpu.busaddr}` === chart.id,
                        )?.vram_usage ?? 0)
                  }
                  isLoading={gpuMemoryData.isLoading}
                  error={
                    chart.id === 'gpu-memory-error'
                      ? gpuMemoryData.error
                      : undefined
                  }
                  refetch={gpuMemoryData.refetch}
                  isRefetching={gpuMemoryData.isRefetching}
                />
              )}
              {chart.type === 'npu' && npuData.data && (
                <NpuChart
                  className="chart w-full"
                  compact
                  device={npuData.data.name}
                  value={npuData.data.value}
                  isLoading={npuData.isLoading}
                  error={chart.id === 'npu-error' ? npuData.error : undefined}
                  refetch={npuData.refetch}
                  isRefetching={npuData.isRefetching}
                />
              )}
              {chart.type === 'power' && powerData.data && (
                <PowerChart
                  className="chart w-full"
                  compact
                  data={{
                    powerConsumption:
                      powerData.data.joulesConsumed /
                      (powerData.data.intervalUs / 1_000_000),
                  }}
                  isLoading={powerData.isLoading}
                  error={
                    chart.id === 'power-error' ? powerData.error : undefined
                  }
                  refetch={powerData.refetch}
                  isRefetching={powerData.isRefetching}
                />
              )}
              {chart.type === 'n/a' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Microchip className="h-4 w-4" />
                        <span>{chart.id.split('-')[0].toUpperCase()}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="max-w-[120px]">
                              <span className="truncate">{chart.device}</span>
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>{chart.device}</span>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-30 w-full items-center justify-center">
                    <div className="text-muted-foreground text-center text-sm">
                      Currently not available
                    </div>
                  </CardContent>
                </Card>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
