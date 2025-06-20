// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

"use client"

import React from 'react'
import { Minus, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "./ui/badge"

interface MetricData {
  name: string
  value: number | string
  unit?: string
  previousValue?: number | string
  trend?: "up" | "down" | "neutral"
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
    <div className={`grid gap-4 mb-6 auto-cols-fr lg:grid-cols-${metrics.length}`}>
      {metrics.map((metric, index) => {
        // Determine trend icon and color
        let TrendIcon = Minus

        if (metric.trend === "up") {
          TrendIcon = TrendingUp
        } else if (metric.trend === "down") {
          TrendIcon = TrendingDown
        }

        return (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-muted-foreground">{metric.name}</div>
                {metric.trendValue && (
                  <div className="flex items-center">
                    <span className="flex items-center text-xs font-medium">
                      <Badge variant="outline" className={`flex items-center`}>
                        <TrendIcon className="h-3 w-3 mr-1" />
                        {metric.trendValue}
                      </Badge>
                    </span>
                  </div>
                )}
              </div>

              <div className="text-3xl font-bold mb-1">
                {metric.value}
                {metric.unit && <span className="text-lg ml-1">{metric.unit}</span>}
              </div>

              {metric.description && (
                <div className="flex items-center text-sm font-medium">
                  <TrendIcon className={`h-3 w-3 mr-1`} />
                  {metric.description}
                </div>
              )}

              {metric.context && (
                <div className="text-xs text-muted-foreground mt-1">
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
