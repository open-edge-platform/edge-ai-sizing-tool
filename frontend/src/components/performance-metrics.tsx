// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from './ui/badge'

interface MetricData {
  name: string
  value: number | string
  unit?: string
  previousValue?: number | string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  description?: string
  context?: string
}

interface PerformanceMetricsProps {
  metrics: MetricData[]
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  if (!metrics || metrics.length === 0) return null

  return (
    <div
      className={`mb-6 grid auto-cols-fr gap-4 lg:grid-cols-${metrics.length}`}
    >
      {metrics.map((metric, index) => {
        // Determine trend icon and color
        let TrendIcon = Minus

        if (metric.trend === 'up') {
          TrendIcon = TrendingUp
        } else if (metric.trend === 'down') {
          TrendIcon = TrendingDown
        }

        return (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {metric.name}
                </div>
                {metric.trendValue && (
                  <div className="flex items-center">
                    <span className="flex items-center text-xs font-medium">
                      <Badge variant="outline" className={`flex items-center`}>
                        <TrendIcon className="mr-1 h-3 w-3" />
                        {metric.trendValue}
                      </Badge>
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-1 text-3xl font-bold">
                {metric.value}
                {metric.unit && (
                  <span className="ml-1 text-lg">{metric.unit}</span>
                )}
              </div>

              {metric.description && (
                <div className="flex items-center text-sm font-medium">
                  <TrendIcon className={`mr-1 h-3 w-3`} />
                  {metric.description}
                </div>
              )}

              {metric.context && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {metric.context}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
