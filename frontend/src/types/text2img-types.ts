// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'

export interface TextToImageMessage {
  port: number
  prompt: string
  inference_step: number
  image_width: number
  image_height: number
}

export interface TextToImageResult {
  generation_time_s: number
  image: string
}

export interface Text2ImgProps {
  workload: Workload
}

export interface TextToImagePerformanceMetrics {
  generation_time_s: number
  throughput_s: number
}
