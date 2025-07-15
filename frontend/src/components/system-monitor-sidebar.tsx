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
import { GpuChart, GpuUtilization } from '@/components/monitor/gpu-chart'
import { NpuChart } from '@/components/monitor/npu-chart'
import { NOT_AVAILABLE } from '@/lib/constants'
import {
  useCpuUtilization,
  useGetGPUs,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
} from '@/hooks/useSystemMonitoring'

// Chart types
type ChartType = 'memory' | 'cpu' | 'gpu' | 'npu' | 'n/a'

interface ChartItem {
  id: string
  type: ChartType
  title: string
  description: string
  icon: React.ElementType
  device?: string
}

export function SystemMonitorSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const { setOpen } = useSidebar()

  // Fetch data using custom hooks
  const { data } = useGetGPUs()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(data?.gpus || [])
  const npuData = useNpuUtilization()

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
        if (gpu.value !== null) {
          items.push({
            id: gpu.uuid || `gpu ${gpu.device}`,
            type: 'gpu',
            title: `GPU: ${gpuDisplayName}`,
            description: 'Graphics processor utilization',
            icon: Zap,
            device: gpu.device,
          })
        } else {
          items.push({
            id: gpu.uuid || `gpu ${gpu.device}`,
            type: 'n/a',
            title: `GPU: ${gpuDisplayName}`,
            description: 'Currently Not Supported',
            icon: Zap,
            device: gpu.device,
          })
        }
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
    }
    return items
  }, [
    gpuData.data,
    gpuData.error,
    gpuData.isLoading,
    npuData.data,
    npuData.error,
    npuData.isLoading,
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
    <Sidebar collapsible="none" className="flex-1" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-foreground text-base font-medium">
            System Monitor
          </div>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <SidebarInput
            placeholder="Search system monitor"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="py-3">
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
                  className="w-full"
                  compact
                  data={cpuData.data}
                  isLoading={cpuData.isLoading}
                  error={cpuData.error}
                  refetch={cpuData.refetch}
                  isRefetching={cpuData.isRefetching}
                />
              )}
              {chart.type === 'memory' && (
                <MemoryChart
                  className="w-full"
                  compact
                  data={memoryData.data}
                  isLoading={memoryData.isLoading}
                  error={memoryData.error}
                  refetch={memoryData.refetch}
                  isRefetching={memoryData.isRefetching}
                />
              )}
              {chart.type === 'gpu' && chart.device && (
                <GpuChart
                  className="w-full"
                  compact
                  device={chart.device}
                  value={
                    gpuData.isLoading
                      ? 0
                      : (gpuData.data?.gpuUtilizations.find(
                          (gpu: GpuUtilization) => gpu.device === chart.device,
                        )?.value ?? 0)
                  }
                  isLoading={gpuData.isLoading}
                  error={chart.id === 'gpu-error' ? gpuData.error : undefined}
                  refetch={gpuData.refetch}
                  isRefetching={gpuData.isRefetching}
                />
              )}
              {chart.type === 'npu' && npuData.data && (
                <NpuChart
                  className="w-full"
                  compact
                  device={npuData.data.name}
                  value={npuData.data.value}
                  isLoading={npuData.isLoading}
                  error={chart.id === 'npu-error' ? npuData.error : undefined}
                  refetch={npuData.refetch}
                  isRefetching={npuData.isRefetching}
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
