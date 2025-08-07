// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Image, MessageSquare, Mic, Video, Speech } from 'lucide-react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function bytesToGigabytes(bytes: number): number {
  return bytes / 1024 ** 3
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' bytes'
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  else return (bytes / 1048576).toFixed(1) + ' MB'
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

export function getUsecaseIcon(usecase: string) {
  switch (usecase) {
    case 'text-to-image':
      return Image
    case 'text generation':
      return MessageSquare
    case 'automatic speech recognition':
      return Mic
    case 'text-to-speech':
      return Speech
    default:
      return Video
  }
}

export function sanitizeText(text: string, maxLength: number = 300): string {
  return text.replace(/[^a-zA-Z0-9\s.,\-!?]/g, '').slice(0, maxLength)
}
