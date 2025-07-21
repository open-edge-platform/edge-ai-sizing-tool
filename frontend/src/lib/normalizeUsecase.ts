// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export function normalizeUseCase(usecase: string): string {
  return usecase
    .replace(/[^a-zA-Z0-9\- ]+/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
