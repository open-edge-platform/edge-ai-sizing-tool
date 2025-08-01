// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function bytesToGigabytes(bytes: number): number {
  return bytes / 1024 ** 3
}

export function calculatePercentage(num: number, total: number): number {
  if (total === 0) return 0
  return (num / total) * 100
}

export function normalizeUseCase(usecase: string): string {
  return usecase
    .replace(/[^a-zA-Z0-9\- ]+/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
