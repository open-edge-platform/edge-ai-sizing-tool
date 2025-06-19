// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Edge AI Sizing Tool',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <main>
          {children}
          <Toaster position="top-right" />
        </main>
      </body>
    </html>
  )
}
