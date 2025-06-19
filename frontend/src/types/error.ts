// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

// Define a custom type for the error object
export interface ValidationError {
  data: {
    errors: {
      label: string
      message: string
    }[]
  }
}

export interface ErrorResponse {
  response?: {
    errors?: ValidationError[]
  }
  message?: string
}
