// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { RefreshCw, Microchip, ServerOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { CartesianGrid, XAxis, Area, AreaChart } from 'recharts'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export interface GpuUtilization {
  uuid: string | null
  device: string
  value: number | null
}

const chartConfig = {
  gpuUsage: {
    label: 'GPU Utilization',
    color: '#0071C5',
  },
} satisfies ChartConfig

interface GpuChartProps {
  className?: string
  compact?: boolean
  device: string
  value: number
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}

export function GpuChart({
  className,
  device,
  value,
  isLoading = false,
  error = null,
  refetch,
  isRefetching = false,
}: GpuChartProps) {
  // Generate time series data for the chart
  const [chartData, setChartData] = useState<
    { time: string; gpuUsage: number }[]
  >([])

  useEffect(() => {
    try {
      if (device) {
        setChartData((prevData) => {
          const newData = [
            ...prevData,
            { time: new Date().toLocaleTimeString(), gpuUsage: value },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update GPU chart data:', err)
    }
  }, [isRefetching, device, value])

  if (isLoading) {
    return (
      <div className={className}>
        <Card className="w-full">
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center py-3">
              <Microchip
                strokeWidth={1.2}
                className="text-muted-foreground mb-2 h-8 w-8 animate-bounce"
              />
              <p className="mb-1 text-center text-sm font-medium">
                Loading GPU data
              </p>
              <p className="text-muted-foreground text-center text-xs">
                Fetching graphics processor metrics...
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
            <div className="flex h-40 flex-col items-center justify-center">
              <ServerOff
                strokeWidth={1.2}
                className="text-muted-foreground mb-2 h-8 w-8"
              />
              <p className="mb-1 text-center text-sm font-medium">
                Failed to load GPU data
              </p>
              <p className="text-muted-foreground mb-3 text-center text-xs">
                {error.message}
              </p>
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
              <Microchip className="h-4 w-4" />
              <span>GPU</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="max-w-[120px]">
                    <span className="truncate">{device}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{device}</span>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="float-right">{Math.round(value)}%</div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-30 w-full" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={chartData}
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
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Area
                dataKey="gpuUsage"
                type="monotone"
                stroke={chartConfig.gpuUsage.color}
                fill={chartConfig.gpuUsage.color}
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
