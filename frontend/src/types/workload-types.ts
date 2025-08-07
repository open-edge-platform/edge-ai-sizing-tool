// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface WorkloadResponse {
  doc: {
    id: number
    task: string
    usecase: string
    model: string
    devices: {
      id: string
      device: string
    }[]
    source: {
      name: string
      size: number | null
    }
    metadata: {
      customModel?: {
        name: string
        size: number | null
        type: string
      }
      numStreams?: number
    }
    port: number
    updatedAt: string
    createdAt: string
  }
  message: string
}
