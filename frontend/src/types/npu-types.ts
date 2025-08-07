// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface NpuUtilization {
  device: string
  value: number | null
}

export interface NpuChartProps {
  className?: string
  compact?: boolean
  device: string
  value: number
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
