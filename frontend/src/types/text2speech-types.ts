// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'

export interface TtsMessage {
  port: number
  text: string
}

export interface TtsResult {
  generation_time_s: number
  audio: string
}

export interface TtsProps {
  workload: Workload
}

export interface TtsPerformanceMetrics {
  generation_time_s: number
}
