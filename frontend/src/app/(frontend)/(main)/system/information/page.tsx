// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

'use client'

import React from 'react'
import { CpuIcon, Layers, Cpu, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useSystemInfo } from '@/hooks/useSystemInformation'
import { NOT_AVAILABLE } from '@/lib/constants'

export default function SystemInformationPage() {
  const { data, isLoading, error } = useSystemInfo()

  if (isLoading) return <div className="text-center">Loading...</div>
  if (error) return <div className="text-center text-red-500">Error: {error.message}</div>

  if (!data) {
    return <div className="text-center text-red-500">No data available</div>
  }

  function displayManufacturerBrand(manufacturer: string, brand: string) {
    if (manufacturer === NOT_AVAILABLE && brand === NOT_AVAILABLE) return NOT_AVAILABLE
    if (manufacturer === NOT_AVAILABLE) return brand
    if (brand === NOT_AVAILABLE) return manufacturer
    return `${manufacturer} ${brand}`
  }

  return (
    <div className="container flex flex-col h-full w-full mx-auto px-6">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto hide-scrollbar">
        <div className="w-full py-6 px-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col justify-left">
              <h1 className="text-lg font-bold">System Information</h1>
            </div>
          </div>
          <div className="w-full grid gap-6">
            {/* System Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="mr-2 h-5 w-5" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Platform:</span>
                      <span>{data.platform}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Distro:</span>
                      <span>{data.osDistro}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">OS Release:</span>
                      <span>{data.osRelease}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Architecture:</span>
                      <span>{data.osArc}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Hostname:</span>
                      <span>{data.hostname}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Kernel:</span>
                      <span>{data.kernelVersion}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Total Memory:</span>
                      <span>
                        {data.memory.total !== NOT_AVAILABLE
                          ? `${data.memory.total} GB`
                          : data.memory.total}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Used Memory:</span>
                      <span>
                        {data.memory.used !== NOT_AVAILABLE
                          ? `${data.memory.used} GB (${data.memory.usedPercentage}%)`
                          : data.memory.used}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Free Memory:</span>
                      <span>
                        {data.memory.free !== NOT_AVAILABLE
                          ? `${data.memory.free} GB (${data.memory.freePercentage}%)`
                          : data.memory.free}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Total Disk Size:</span>
                      <span>
                        {data.disk.total !== NOT_AVAILABLE
                          ? `${data.disk.total} GB`
                          : data.disk.total}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Used Disk Size:</span>
                      <span>
                        {data.disk.used !== NOT_AVAILABLE
                          ? `${data.disk.used} GB (${data.disk.usedPercentage}%)`
                          : data.disk.used}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Free Disk Size:</span>
                      <span>
                        {data.disk.free !== NOT_AVAILABLE
                          ? `${data.disk.free} GB (${data.disk.freePercentage}%)`
                          : data.disk.free}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CPU Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CpuIcon className="mr-2 h-5 w-5" />
                  CPU Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {displayManufacturerBrand(data.manufacturer, data.brand)}
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-sm text-muted-foreground">Physical Cores:</div>
                        <div className="text-sm font-medium">{data.physicalCores}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-sm text-muted-foreground">Threads:</div>
                        <div className="text-sm font-medium">{data.threads}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-sm text-muted-foreground">Min Speed:</div>
                        <div className="text-sm font-medium">
                          {data.cpuSpeedMin !== NOT_AVAILABLE
                            ? `${data.cpuSpeedMin} GHz`
                            : data.cpuSpeedMin}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-sm text-muted-foreground">Max Speed:</div>
                        <div className="text-sm font-medium">
                          {data.cpuSpeedMax !== NOT_AVAILABLE
                            ? `${data.cpuSpeedMax} GHz`
                            : data.cpudSpeedMax}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Temperature</div>
                        <div className="text-sm font-medium">
                          {data.temperature !== NOT_AVAILABLE
                            ? `${data.temperature} °C`
                            : data.temperature}
                        </div>
                      </div>
                      {data?.temperature !== NOT_AVAILABLE && (
                        <Progress value={data.temperature} className="h-2" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPU Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="mr-2 h-5 w-5" />
                  GPU Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.gpuInfo && data.gpuInfo.length > 0 ? (
                  <div className="space-y-4">
                    {data.gpuInfo.map((gpu: { name: string; device: string }, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="text-sm text-muted-foreground">Model:</div>
                          <div className="text-sm font-medium">{gpu.name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="text-sm text-muted-foreground">Device:</div>
                          <div className="text-sm font-medium">{gpu.device !== NOT_AVAILABLE ? gpu.device : gpu.device}</div>
                        </div>
                        {index < data.gpuInfo.length - 1 && <hr className="my-2" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="gap-1 flex items-center">
                        <div className="text-sm text-bold">
                          There are no available GPU devices...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* NPU Card */}
            {data.npu && data.npu !== NOT_AVAILABLE && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Cpu className="mr-2 h-5 w-5" />
                    Neural Processing Unit (NPU)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-1">
                    <div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="text-sm text-muted-foreground">Model:</div>
                          <div className="text-sm font-medium">{data.npu}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          {/* </main> */}
        </div>
      </div>
    </div>
  )
}