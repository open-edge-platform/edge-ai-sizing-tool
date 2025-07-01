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
import {
  Cpu,
  HardDrive,
  Image,
  MessageSquare,
  Mic,
  Server,
  Zap,
  Video,
} from 'lucide-react'
import { useWorkloads } from '@/hooks/useWorkload'
import { Workload } from '@/payload-types'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { NOT_AVAILABLE } from '@/lib/constants'
import {
  useCpuUtilization,
  useGetGPUs,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
} from '@/hooks/useSystemMonitoring'

// Helper function to get icon based on usecase
const getUsecaseIcon = (usecase: string) => {
  switch (usecase) {
    case 'text-to-image':
      return Image
    case 'text-generation':
      return MessageSquare
    case 'automatic-speech-recognition':
      return Mic
    default:
      return Video
  }
}

export default function DashboardPage() {
  const { data } = useGetGPUs()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(data?.gpus || [])
  const npuData = useNpuUtilization()
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
                      {(
                        ((memoryData.data?.memoryUsage ?? 0) *
                          (memoryData.data?.total ?? 0)) /
                        100
                      )?.toFixed(1)}{' '}
                      GB / {memoryData.data?.total ?? 0} GB
                    </span>
                  </div>
                  <Progress value={memoryData.data?.memoryUsage ?? 0} />
                </div>

                {gpuData.data?.gpuUtilizations.map((gpu) => (
                  <div key={gpu.device} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Zap className="h-4 w-4" /> {gpu.device} Usage
                      </span>
                      <span>
                        {gpu.value !== null
                          ? `${gpu.value.toFixed(1)}%`
                          : 'Currently not available'}
                      </span>
                    </div>
                    <Progress value={gpu.value ?? 0} />
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
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data?.manufacturer === NOT_AVAILABLE &&
                          systemInfo.data?.brand === NOT_AVAILABLE
                        ? NOT_AVAILABLE
                        : systemInfo.data?.manufacturer === NOT_AVAILABLE
                          ? systemInfo.data?.brand
                          : systemInfo.data?.brand === NOT_AVAILABLE
                            ? systemInfo.data?.manufacturer
                            : `${systemInfo.data?.manufacturer} ${systemInfo.data?.brand}`}
                  </div>
                  <div className="text-muted-foreground">Cores</div>
                  <div>{systemInfo.data?.physicalCores}</div>

                  <div className="text-muted-foreground">Threads</div>
                  <div>{systemInfo.data?.threads}</div>
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
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data.disk.total !== NOT_AVAILABLE
                        ? `${systemInfo.data.disk.total} GB`
                        : systemInfo.data.disk.total}
                  </div>
                  <div className="text-muted-foreground">Used</div>
                  <div>
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data?.disk.used !== NOT_AVAILABLE
                        ? `${systemInfo.data?.disk.used} GB`
                        : systemInfo.data?.disk.used}
                  </div>
                  <div className="text-muted-foreground">Free</div>
                  <div>
                    {!systemInfo.data
                      ? ''
                      : systemInfo.data?.disk.free !== NOT_AVAILABLE
                        ? `${systemInfo.data?.disk.free} GB`
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
