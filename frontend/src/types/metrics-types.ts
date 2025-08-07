// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface MetricData {
  name: string
  value: number | string
  unit?: string
  previousValue?: number | string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  description?: string
  context?: string
}

export interface PerformanceMetricsProps {
  metrics: MetricData[]
}
