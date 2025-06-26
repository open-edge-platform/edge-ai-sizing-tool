// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from '@/components/ui/breadcrumb'
import { useRouter } from 'next/navigation'
import Providers from '@/context/providers'

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <Providers>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <SidebarInset className="flex h-screen w-full flex-col overflow-hidden">
            <header className="bg-red flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <button
                      onClick={() => router.push('/')}
                      className="text-primary line-clamp-1 text-xl font-bold"
                    >
                      Edge AI Sizing Tool
                    </button>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>

            <main className="w-full flex-1 overflow-hidden">
              <div className="max-w-screen-3xl mx-auto flex h-full w-full flex-wrap justify-center gap-4">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </Providers>
  )
}
