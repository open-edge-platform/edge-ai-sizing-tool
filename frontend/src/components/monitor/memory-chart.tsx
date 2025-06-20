// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { HardDrive, RefreshCw, MemoryStick, ServerOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

export interface MemoryUtilizationData {
  memoryUsage: number
  total: number
}

const chartConfig = {
  memoryUsage: {
    label: 'Memory Utilization',
    color: '#0071C5',
  },
} satisfies ChartConfig

interface MemoryChartProps {
  className?: string
  compact?: boolean
  data?: MemoryUtilizationData | null
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}

export function MemoryChart({
  className,
  data,
  isLoading = false,
  error = null,
  refetch,
}: MemoryChartProps) {
  const [chartData, setChartData] = useState<
    { time: string; memoryUsage: number; total: number }[]
  >([])

  useEffect(() => {
    try {
      if (data) {
        setChartData((prevData) => {
          const newData = [
            ...prevData,
            {
              time: new Date().toLocaleTimeString(),
              memoryUsage: data.memoryUsage,
              total: data.total,
            },
          ]
          return newData.length > 10 ? newData.slice(newData.length - 10) : newData
        })
      }
    } catch (err) {
      console.error('Failed to update memory chart data:', err)
    }
  }, [data])

  if (isLoading) {
    return (
      <div className={className}>
        <Card className="w-full">
          <CardContent>
            <div className="flex flex-col items-center justify-center h-40 py-3">
              <HardDrive
                strokeWidth={1.2}
                className="h-8 w-8 mb-2 animate-bounce text-muted-foreground"
              />
              <p className="text-sm font-medium text-center mb-1">Loading memory data</p>
              <p className="text-xs text-muted-foreground text-center">
                Fetching memory utilization metrics...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <Card className="w-full">
          <CardContent>
            <div className="flex flex-col items-center justify-center h-40">
              <ServerOff strokeWidth={1.2} className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-center mb-1">Failed to load memory data</p>
              <p className="text-xs text-muted-foreground text-center mb-3">{error.message}</p>
              {refetch && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={refetch}
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4" />
              Memory
            </div>
            <div className="float-right">
              {Math.round(data?.memoryUsage ?? 0)}% of {data?.total ?? 0}GB
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-30 w-full" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 0,
                right: 0,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Area
                dataKey="memoryUsage"
                type="monotone"
                stroke={chartConfig.memoryUsage.color}
                fill={chartConfig.memoryUsage.color}
                fillOpacity={0.5}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
