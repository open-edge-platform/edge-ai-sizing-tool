// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Info, Search } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

// System sidebar items
const systemItems = [
  {
    id: 'information',
    title: 'Information',
    description: 'System hardware and software details',
    icon: Info,
    path: '/system/information',
  },
]

export function SystemDetailsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [activeItem, setActiveItem] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const { setOpen } = useSidebar()

  // Filter items based on search term
  const filteredItems = React.useMemo(() => {
    return systemItems.filter(
      (item) =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [searchTerm])

  // Handle item selection
  const handleSelectItem = (item: (typeof systemItems)[0]) => {
    setActiveItem(item.id)
    setOpen(true)
    router.push(item.path)
  }

  return (
    <Sidebar collapsible="none" className="flex-1" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-foreground text-base font-medium">
            System Details
          </div>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <SidebarInput
            placeholder="Search system details"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {filteredItems.map((item) => (
            <SidebarMenuItem key={item.id} className="h-14">
              <SidebarMenuButton
                onClick={() => handleSelectItem(item)}
                isActive={activeItem === item.id}
                className="hover:bg-sidebar-primary/5 data-[active=true]:bg-sidebar-primary/5 h-14 justify-start rounded-none"
              >
                <div className="bg-background flex h-8 w-8 items-center justify-center rounded-md border">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="grid flex-1 gap-0.5">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.description}
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
