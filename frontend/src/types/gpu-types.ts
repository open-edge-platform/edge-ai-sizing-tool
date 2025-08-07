// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface GpuData {
  device: string
  busaddr: string | null
}

export interface DeviceLevelMetric {
  metrics_type: string
  avg?: number
  value?: number
}

export interface GpuUtilization {
  uuid: string | null
  device: string
  value: number | null
}

export interface GpuChartProps {
  className?: string
  compact?: boolean
  device: string
  value: number
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}

export interface GpuMemoryUtilization {
  device: string
  busaddr: string | null
  vram_usage: number | null
}

export interface GpuMemoryChartProps {
  className?: string
  compact?: boolean
  device: string
  value: number
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
