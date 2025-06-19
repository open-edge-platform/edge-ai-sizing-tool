// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { CpuIcon, RefreshCw, Cpu, ServerOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { AreaChart, CartesianGrid, XAxis, Area } from 'recharts'

export interface CpuUtilizationData {
  cpuUsage: number
}

const chartConfig = {
  cpuUsage: {
    label: 'CPU Utilization',
    color: '#0071C5',
  },
} satisfies ChartConfig

interface CpuChartProps {
  className?: string
  compact?: boolean
  data?: CpuUtilizationData | null
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
export function CpuChart({
  className,
  data,
  isLoading = false,
  error = null,
  refetch,
}: CpuChartProps) {
  const [chartData, setChartData] = useState<
    { time: string; cpuUsage: number }[]
  >([])

  useEffect(() => {
    try {
      if (data) {
        setChartData((prevData) => {
          const newData = [
            ...prevData,
            { time: new Date().toLocaleTimeString(), cpuUsage: data.cpuUsage },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update CPU chart data:', err)
    }
  }, [data])

  if (isLoading) {
    return (
      <div className={className}>
        <Card className="w-full">
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center py-3">
              <CpuIcon
                strokeWidth={1.2}
                className="text-muted-foreground mb-2 h-8 w-8 animate-bounce"
              />
              <p className="mb-1 text-center text-sm font-medium">
                Loading CPU data
              </p>
              <p className="text-muted-foreground text-center text-xs">
                Fetching processor utilization metrics...
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
                Failed to load CPU data
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
              <Cpu className="h-4 w-4" />
              CPU
            </div>
            <div className="float-right">
              {data ? `${Math.round(data.cpuUsage)}%` : 'N/A'}
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
                dataKey="cpuUsage"
                type="monotone"
                stroke={chartConfig.cpuUsage.color}
                fill={chartConfig.cpuUsage.color}
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
