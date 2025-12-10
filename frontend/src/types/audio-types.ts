// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'

export interface AudioMessage {
  port: number
  file: string
  task: string
  language: string
}

export interface AudioResult {
  generation_time_s: number
  text: string
}

export interface AudioProps {
  workload: Workload
}

export interface AudioPerformanceMetrics {
  generation_time_s: number
}
