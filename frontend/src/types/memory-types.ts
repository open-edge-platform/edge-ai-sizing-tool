// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface MemoryUtilizationData {
  usedPercentage: number
  total: number
}

export interface MemoryChartProps {
  className?: string
  compact?: boolean
  data?: MemoryUtilizationData | null
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
