// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import { ChartNoAxesCombined, Info, Package } from 'lucide-react'

import { WorkloadsSidebar } from '@/components/workloads-sidebar'
import { SystemMonitorSidebar } from '@/components/system-monitor-sidebar'
import { SystemDetailsSidebar } from '@/components/system-details-sidebar'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const data = {
  user: {
    name: 'admin',
    email: 'admin@edge-ai.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Workloads',
      icon: Package,
      isActive: true,
      component: WorkloadsSidebar,
    },
    {
      title: 'System Monitor',
      icon: ChartNoAxesCombined,
      isActive: false,
      component: SystemMonitorSidebar,
    },
    {
      title: 'System Details',
      icon: Info,
      isActive: false,
      component: SystemDetailsSidebar,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const { setOpen } = useSidebar()

  // Get the active component
  const ActiveSidebarComponent = activeItem.component

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem?.title === item.title}
                      className="hover:bg-sidebar-primary/5 data-[active=true]:bg-sidebar-primary px-2.5 data-[active=true]:text-white md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* This is the second sidebar - dynamically rendered based on active item */}
      {ActiveSidebarComponent && <ActiveSidebarComponent />}
    </Sidebar>
  )
}
