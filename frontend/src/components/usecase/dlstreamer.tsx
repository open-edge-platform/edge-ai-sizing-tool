// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
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
// A simple hash function to dynamically generate a color for each stream id for the chart.
function getColorForKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash)
  }

  const hue = (hash * 137.508) % 3602
  return `hsl(${hue}, 70%, 50%)`
}

export function DlStreamer({ workload }: DlStreamerProps) {
  const [streamFpsData, setStreamFpsData] = useState<
    Array<Record<string, number>>
  >([])

  const { data, isLoading, isSuccess } = useGetStreamMetricInterval(
    workload.port ?? 8080,
  )
  const maxCount = 10

  // Update the FPS data every second
  useEffect(() => {
    if (data) {
      try {
        const { total_fps, fps_streams } = data.data
        if (typeof total_fps === 'number' && fps_streams) {
          const newEntry: Record<string, number> = {
            time: Date.now(),
            total_fps: total_fps, // store total in the same record
          }

          for (const [streamId, fpsValue] of Object.entries(fps_streams)) {
            newEntry[streamId] = Number(fpsValue)
          }

          // Keep only the last 10 records
          setStreamFpsData((prev) => {
            const updated = [...prev, newEntry]
            return updated.length > maxCount
              ? updated.slice(-maxCount)
              : updated
          })
        }
      } catch (err) {
        console.error('Failed to parse stream metrics:', err)
      }
    }
  }, [data])

  const chartConfig: Record<string, { label: string; color: string }> = {
    fps: {
      label: 'FPS',
      color: 'var(--chart-1)',
    },
  }

  const tickFormatter = (value: string, index: number) => {
    if (index === 0) return '10s'
    if (index === maxCount - 1) return '0'
    return '' // middle ticks are blank
  }

  // Plot each stream's FPS as a separate line, exclude total_fps and time
  const allNumericKeys = Object.keys(streamFpsData[0] ?? {}).filter(
    (k) => k !== 'time' && k !== 'total_fps',
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-4">
          {isLoading && <Loader className="mx-auto animate-spin" />}
          {isSuccess && (
            <Card>
              <CardHeader>
                <CardTitle>
                  FPS (Total: {data?.data.total_fps} fps, Average Per Stream:{' '}
                  {data?.data.average_fps_per_stream} fps)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="h-[150px] w-full"
                >
                  <LineChart
                    data={streamFpsData}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={tickFormatter}
                    />
                    <YAxis
                      type="number"
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      allowDecimals
                    />
                    <ChartTooltip
                      cursor={true}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    {allNumericKeys.map((key) => {
                      const label = chartConfig[key]?.label || key
                      return (
                        <Line
                          key={key}
                          dataKey={key}
                          type="monotone"
                          strokeWidth={2}
                          dot={false}
                          name={label}
                          stroke={getColorForKey(key)}
                        />
                      )
                    })}
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
