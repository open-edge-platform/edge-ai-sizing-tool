// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { ProfilingProvider } from '@/contexts/profiling-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProfilingProvider>{children}</ProfilingProvider>
}
