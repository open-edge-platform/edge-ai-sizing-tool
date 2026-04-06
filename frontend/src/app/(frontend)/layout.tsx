// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Edge AI Sizing Tool',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <main>
            {children}
            <Toaster position="top-right" />
          </main>
        </Providers>
      </body>
    </html>
  )
}
