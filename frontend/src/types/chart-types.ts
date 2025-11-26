// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

type ChartType =
  | 'memory'
  | 'cpu'
  | 'gpu'
  | 'npu'
  | 'gpu-memory'
  | 'power'
  | 'n/a'

export interface ChartItem {
  id: string
  type: ChartType
  title: string
  description: string
  icon: React.ElementType
  device?: string
}
