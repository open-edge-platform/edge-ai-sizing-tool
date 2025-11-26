// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { Zap, RefreshCw, ServerOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { AreaChart, CartesianGrid, XAxis, Area } from 'recharts'
import { PowerChartProps } from '@/types/power-types'

const chartConfig = {
  powerUsage: {
    label: 'Power Usage',
    color: '#0071C5',
  },
} satisfies ChartConfig

export function PowerChart({
  className,
  data,
  isLoading = false,
  error = null,
  refetch,
}: PowerChartProps) {
  const [chartData, setChartData] = useState<
    { time: string; powerUsage: number | null }[]
  >([])
  const lastPowerValueRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      if (data && data.powerConsumption !== lastPowerValueRef.current) {
        lastPowerValueRef.current = data.powerConsumption
        setChartData((prevData) => {
          const newData = [
            ...prevData,
            {
              time: new Date().toLocaleTimeString(),
              powerUsage: data.powerConsumption,
            },
          ]
          return newData.length > 10
            ? newData.slice(newData.length - 10)
            : newData
        })
      }
    } catch (err) {
      console.error('Failed to update Power chart data:', err)
    }
  }, [data])

  if (isLoading) {
    return (
      <div className={className}>
        <Card className="w-full">
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center py-3">
              <Zap
                strokeWidth={1.2}
                className="text-muted-foreground mb-2 h-8 w-8 animate-bounce"
              />
              <p className="mb-1 text-center text-sm font-medium">
                Loading power data
              </p>
              <p className="text-muted-foreground text-center text-xs">
                Fetching power consumption metrics...
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
                Failed to load power data
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
              <Zap className="h-4 w-4" />
              Power Consumption
            </div>
            <div className="float-right">
              {data && data.powerConsumption !== null
                ? `${Math.round(data.powerConsumption * 100) / 100}W`
                : 'N/A'}
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
                dataKey="powerUsage"
                type="monotone"
                stroke={chartConfig.powerUsage.color}
                fill={chartConfig.powerUsage.color}
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
