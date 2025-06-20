// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

'use client'

import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb'
import { useRouter } from 'next/navigation'

const queryClient = new QueryClient()
export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider
        defaultOpen={true}
        style={
          {
            '--sidebar-width': '400px',
          } as React.CSSProperties
        }
      >
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <SidebarInset className="flex flex-col w-full overflow-hidden h-screen">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-red">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <button
                        onClick={() => router.push('/')}
                        className="line-clamp-1 text-xl font-bold text-primary"
                      >
                        Edge AI Sizing Tool
                      </button>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>

              <main className="flex-1 overflow-hidden w-full">
                <div className="mx-auto flex w-full max-w-screen-3xl flex-wrap justify-center gap-4 h-full">
                  {children}
                </div>
              </main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
