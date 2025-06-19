// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Workload } from '@/payload-types'
import { WorkloadProfile } from '../workload-profile'
import useGetStreamMetricInterval from '@/hooks/useStream'
import { Loader } from 'lucide-react'

interface DlStreamerProps {
  workload: Workload
}

export function DlStreamer({ workload }: DlStreamerProps) {
  const [fpsData, setFpsData] = useState<
    Array<{ time: number | null; fps: number | null }>
  >(Array(10).fill({ time: null, fps: null }))
  const { data, isLoading, isSuccess } = useGetStreamMetricInterval(
    workload.port ?? 8080,
  )
  const maxCount = 10

  // Update the FPS data every second
  useEffect(() => {
    try {
      if (data) {
        const fps = data.data.total_fps

        setFpsData((prevData) => {
          const newData = [...prevData, { time: Date.now(), fps }]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update FPS chart data:', err)
    }
  }, [data])

  const chartConfig = {
    fps: {
      label: 'FPS',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const tickFormatter = (value: string, index: number) => {
    if (index === 0) return '10s'
    if (index === maxCount - 1) return '0'
    return '' // middle ticks are blank
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-4">
          {isLoading && <Loader className="mx-auto animate-spin" />}
          {isSuccess && (
            <Card>
              <CardHeader>
                <CardTitle>FPS (Current: {data?.data.total_fps} fps)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="h-[150px] w-full"
                >
                  <LineChart
                    accessibilityLayer
                    data={fpsData}
                    margin={{
                      left: 12,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={tickFormatter}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Line
                      dataKey="fps"
                      type="linear"
                      stroke="var(--color-fps)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <YAxis dataKey="fps" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Workload: {workload.usecase}</CardTitle>
            </CardHeader>
            <CardContent className="flex h-full items-center space-y-4">
              <div className="relative aspect-video h-full w-full overflow-hidden rounded-lg bg-black">
                <Image
                  alt="dlstreamer-stream"
                  className="h-full w-full"
                  src={`/api/stream?port=${workload.port}`}
                  width={1920}
                  height={1080}
                  unoptimized
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="h-full">
          <WorkloadProfile workload={workload} />
        </div>
      </div>
    </div>
  )
}
