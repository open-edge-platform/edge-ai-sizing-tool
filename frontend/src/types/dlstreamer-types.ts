// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'

export interface DlStreamerProps {
  workload: Workload
}

export interface DlStreamerPerformanceMetrics {
  total_fps: number
  average_fps_per_stream: number
}
