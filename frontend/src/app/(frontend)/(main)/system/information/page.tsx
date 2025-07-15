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
  if (error)
    return (
      <div className="text-center text-red-500">Error: {error.message}</div>
    )

  if (!data) {
    return <div className="text-center text-red-500">No data available</div>
  }

  function displayManufacturerBrand(manufacturer: string, brand: string) {
    if (manufacturer === NOT_AVAILABLE && brand === NOT_AVAILABLE)
      return NOT_AVAILABLE
    if (manufacturer === NOT_AVAILABLE) return brand
    if (brand === NOT_AVAILABLE) return manufacturer
    return `${manufacturer} ${brand}`
  }

  return (
    <div className="container mx-auto flex h-full w-full flex-col px-6">
      {/* Scrollable Content Area */}
      <div className="hide-scrollbar flex-1 overflow-auto">
        <div className="w-full px-2 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="justify-left flex flex-col">
              <h1 className="text-lg font-bold">System Information</h1>
            </div>
          </div>
          <div className="grid w-full gap-6">
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
                    <h3 className="mb-2 text-lg font-semibold">
                      {displayManufacturerBrand(data.manufacturer, data.brand)}
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-muted-foreground text-sm">
                          Physical Cores:
                        </div>
                        <div className="text-sm font-medium">
                          {data.physicalCores}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-muted-foreground text-sm">
                          Threads:
                        </div>
                        <div className="text-sm font-medium">
                          {data.threads}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-muted-foreground text-sm">
                          Min Speed:
                        </div>
                        <div className="text-sm font-medium">
                          {data.cpuSpeedMin !== NOT_AVAILABLE
                            ? `${data.cpuSpeedMin} GHz`
                            : data.cpuSpeedMin}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="text-muted-foreground text-sm">
                          Max Speed:
                        </div>
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
                      <div className="mb-2 flex items-center justify-between">
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
                    {data.gpuInfo.map(
                      (
                        gpu: { name: string; device: string },
                        index: number,
                      ) => (
                        <div key={index} className="space-y-2">
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-muted-foreground text-sm">
                              Model:
                            </div>
                            <div className="text-sm font-medium">
                              {gpu.name}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="text-muted-foreground text-sm">
                              Device:
                            </div>
                            <div className="text-sm font-medium">
                              {gpu.device}
                            </div>
                          </div>
                          {index < data.gpuInfo.length - 1 && (
                            <hr className="my-2" />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <div className="text-bold text-sm">
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
                          <div className="text-muted-foreground text-sm">
                            Model:
                          </div>
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
