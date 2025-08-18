// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Cpu, HardDrive, Server, Zap, MemoryStick } from 'lucide-react'
import { useWorkloads } from '@/hooks/useWorkload'
import { Workload } from '@/payload-types'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { NOT_AVAILABLE } from '@/lib/constants'
import {
  useCpuUtilization,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
  useGPUXpum,
  useGpuMemory,
} from '@/hooks/useSystemMonitoring'
import { getUsecaseIcon } from '@/lib/utils'

export default function DashboardPage() {
  const { data: XpumData } = useGPUXpum()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(XpumData?.gpus || [])
  const npuData = useNpuUtilization()
  const gpuMemoryData = useGpuMemory(XpumData?.gpus || [])
  const workloadsData = useWorkloads()
  const systemInfo = useSystemInfo()

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle>System Overview</CardTitle>
              <CardDescription>Current hardware utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-4 w-4" /> CPU Usage
                    </span>
                    <span>{cpuData.data?.cpuUsage?.toFixed(1) ?? 0}%</span>
                  </div>
                  <Progress value={cpuData.data?.cpuUsage ?? 0} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4" /> Memory Usage
                    </span>
                    <span>
                      {memoryData.data?.used.toFixed(1) ?? 0} GB /{' '}
                      {memoryData.data?.total.toFixed(0) ?? 0} GB
                    </span>
                  </div>
                  <Progress value={memoryData.data?.usedPercentage ?? 0} />
                </div>

                {gpuData.data?.gpuUtilizations.map((gpu) => (
                  <div
                    key={`${gpu.busaddr ?? gpu.device ?? 'unknown'}`}
                    className="space-y-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Zap className="h-4 w-4" /> {gpu.device} Usage
                      </span>
                      <span>
                        {gpu.compute_usage !== null
                          ? `${gpu.compute_usage.toFixed(1)}%`
                          : 'Currently not available'}
                      </span>
                    </div>
                    <Progress value={gpu.compute_usage ?? 0} />
                  </div>
                ))}

                {gpuMemoryData.data?.gpuMemory.map((gpu) => (
                  <div key={gpu.busaddr || gpu.device} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <MemoryStick className="h-4 w-4" /> {gpu.device} Memory
                        Usage
                      </span>
                      <span>
                        {gpu.vram_usage !== null
                          ? `${gpu.vram_usage.toFixed(1)}%`
                          : 'Currently not available'}
                      </span>
                    </div>
                    <Progress value={gpu.vram_usage ?? 0} />
                  </div>
                ))}

                {npuData.data && npuData.data.name !== NOT_AVAILABLE && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Zap className="h-4 w-4" /> NPU Usage
                      </span>
                      <span>
                        {npuData.data.value !== null
                          ? `${npuData.data.value?.toFixed(1)}%`
                          : 'Currently not available'}
                      </span>
                    </div>
                    <Progress value={npuData.data.value ?? 0} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Active Workloads</CardTitle>
              <CardDescription>Running AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workloadsData?.data?.docs.map((workload: Workload) => {
                  const UsecaseIcon = getUsecaseIcon(workload.usecase)
                  return (
                    <div
                      key={workload.id}
                      className="flex items-center gap-3 rounded-md border p-2"
                    >
                      <div className="bg-background flex h-8 w-8 items-center justify-center rounded-md border">
                        <UsecaseIcon className="h-4 w-4" />
                      </div>
                      <div className="grid flex-1 gap-0.5">
                        <div className="text-sm font-medium">
                          {workload.model.split('/').length > 1
                            ? workload.model.split('/')[1]
                            : workload.model}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <span>{workload.usecase.replace(/-/g, ' ')}</span>
                          <span>•</span>
                          <span>
                            {workload.devices.map((d) => d.device).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Hardware Configuration</CardTitle>
            <CardDescription>System hardware details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="text-muted-foreground h-5 w-5" />
                  <h3 className="font-medium">CPU</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Model</div>
                  <div>
                    {!systemInfo.data?.cpu
                      ? ''
                      : systemInfo.data?.cpu.manufacturer === NOT_AVAILABLE &&
                          systemInfo.data?.cpu.brand === NOT_AVAILABLE
                        ? NOT_AVAILABLE
                        : systemInfo.data?.cpu.manufacturer === NOT_AVAILABLE
                          ? systemInfo.data?.cpu.brand
                          : systemInfo.data?.cpu.brand === NOT_AVAILABLE
                            ? systemInfo.data?.cpu.manufacturer
                            : `${systemInfo.data?.cpu.manufacturer} ${systemInfo.data?.cpu.brand}`}
                  </div>
                  <div className="text-muted-foreground">Cores</div>
                  <div>{systemInfo.data?.cpu.physicalCores}</div>

                  <div className="text-muted-foreground">Threads</div>
                  <div>{systemInfo.data?.cpu.threads}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="text-muted-foreground h-5 w-5" />
                  <h3 className="font-medium">Disk</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Total</div>
                  <div>
                    {!systemInfo.data?.disk
                      ? ''
                      : systemInfo.data?.disk?.total !== NOT_AVAILABLE
                        ? `${systemInfo.data?.disk.total.toFixed(0)} GB`
                        : systemInfo.data?.disk.total}
                  </div>
                  <div className="text-muted-foreground">Used</div>
                  <div>
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data?.disk?.used !== NOT_AVAILABLE
                        ? `${systemInfo.data?.disk.used.toFixed(0)} GB`
                        : systemInfo.data?.disk.used}
                  </div>
                  <div className="text-muted-foreground">Free</div>
                  <div>
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data?.disk.free !== NOT_AVAILABLE
                        ? `${systemInfo.data?.disk.free.toFixed(0)} GB`
                        : systemInfo.data?.disk.free}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="text-muted-foreground h-5 w-5" />
                  <h3 className="font-medium">GPUs</h3>
                </div>
                <div className="space-y-2">
                  {systemInfo.data?.gpuInfo.map(
                    (gpu: { name: string; device: string }) => (
                      <div
                        key={gpu.device}
                        className="grid grid-cols-2 gap-2 text-sm"
                      >
                        <div className="text-muted-foreground">
                          {gpu.device}
                        </div>
                        <div>{gpu.name}</div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {systemInfo.data?.npu && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Server className="text-muted-foreground h-5 w-5" />
                    <h3 className="font-medium">NPU</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Model</div>
                    <div>{systemInfo.data?.npu}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
