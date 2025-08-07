// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface CpuTimes {
  user: number
  nice: number
  sys: number
  idle: number
  irq: number
}

export interface CpuUsage {
  idle: number
  total: number
}

export interface CpuUtilizationData {
  cpuUsage: number
}

export interface CpuChartProps {
  className?: string
  compact?: boolean
  data?: CpuUtilizationData | null
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
