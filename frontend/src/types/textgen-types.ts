// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'

export interface TextGenerationMessage {
  port: number
  prompt: string
  max_tokens: number
}

export interface TextGenerationResult {
  generation_time_s: number
  load_time_s: number
  text: string
  throughput_s: number
  time_to_token_s: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface TextGenProps {
  workload: Workload
}
