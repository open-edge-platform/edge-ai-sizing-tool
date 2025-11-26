// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface PowerUsage {
  intervalUs: number | null
  joulesConsumed: number | null
}

export interface PowerConsumptionData {
  powerConsumption: number | null
}

export interface PowerChartProps {
  className?: string
  compact?: boolean
  data?: PowerConsumptionData | null
  isLoading?: boolean
  error?: Error | null
  refetch?: () => void
  isRefetching?: boolean
}
