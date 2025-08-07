// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React, { useMemo, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  MoreVertical,
  Package,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  ServerOff,
  SquarePen,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useDeleteWorkload, useWorkloads } from '@/hooks/useWorkload'
import { Workload } from '@/payload-types'
import { toast } from 'sonner'
import { getUsecaseIcon } from '@/lib/utils'

export function WorkloadsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const workloadsData = useWorkloads()
  const deleteWorkload = useDeleteWorkload()
  const [activeWorkload, setActiveWorkload] = useState<Workload | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { id: currentPageID } = useParams<{ id: string }>()
  const pathname = usePathname()

  // Filter workloads based on search term
  const filteredWorkloads = useMemo(() => {
    return workloadsData.data?.docs.filter(
      (workload: { usecase: string; model: string; task: string }) =>
        workload.usecase.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workload.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workload.task.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [workloadsData.data?.docs, searchTerm])

  // Handle workload deletion
  const handleDeleteWorkload = async (id: number, usecase: string) => {
    try {
      const response = await deleteWorkload.mutateAsync(id)
      if (!response) {
        toast.error('Failed to delete workload')
        return
      }
      toast.success(
        `Workload ${usecase.replace(/[()\s]+/g, '-').toLowerCase()}-${id} deleted successfully`,
      )
      if (
        pathname.split('/')[1] === 'workload' &&
        currentPageID === id.toString()
      ) {
        router.push(`/`)
      }
    } catch (error) {
      toast.error('Failed to delete workload')
      console.error('Failed to delete workload:', error)
    }
  }

  // Handle workload selection
  const handleSelectWorkload = (workload: Workload) => {
    router.push(`/workload/${workload.id}`)
    setActiveWorkload(workload)
  }

  return (
    <Sidebar collapsible="none" className="flex-1" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-foreground text-base font-medium">Workloads</div>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <SidebarInput
            placeholder="Search workloads"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          className="flex w-full items-center justify-center gap-2"
          size="sm"
          onClick={() => router.push('/workload/add')}
        >
          <Plus className="h-4 w-4" />
          Add Workload
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {workloadsData.isLoading ? (
          <div className="mt-8 flex flex-col items-center justify-center p-8 text-center">
            <Package
              strokeWidth={0.6}
              className="text-primary mb-4 h-16 w-16 animate-bounce"
            />
            <h3 className="mb-1 font-medium">Loading workloads</h3>
            <p className="text-muted-foreground text-xs">
              Fetching your AI workloads...
            </p>
          </div>
        ) : workloadsData.isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ServerOff
              strokeWidth={0.6}
              className="text-muted-foreground mb-4 h-16 w-16"
            />
            <h3 className="mb-1 font-medium">Failed to load workloads</h3>
            <p className="text-muted-foreground mb-4 text-xs">
              {workloadsData.error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => workloadsData.refetch()}
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : workloadsData.data?.totalDocs === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <PackagePlus
              strokeWidth={0.6}
              className="text-muted-foreground mb-2 h-16 w-16 opacity-30"
            />
            <h3 className="mb-1 font-medium">No workloads created yet</h3>
            <p className="text-muted-foreground mb-4 text-xs">
              Get started by creating your first workload
            </p>
            <div className="max-w-xs space-y-4">
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Click &quot;Add Workload&quot; above
                  </p>
                  <p className="text-muted-foreground text-xs">
                    To create a new workload
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">Configure your workload</p>
                  <p className="text-muted-foreground text-xs">
                    Choose task, usecase, model, and devices
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">Deploy and run</p>
                  <p className="text-muted-foreground text-xs">
                    Your workload will appear in this list
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : filteredWorkloads?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <PackageSearch
              strokeWidth={0.6}
              className="text-muted-foreground mb-4 h-16 w-16 opacity-30"
            />
            <h3 className="mb-1 font-medium">No matching workloads</h3>
            <p className="text-muted-foreground mb-4 text-xs">
              No workloads match your search term &quot;{searchTerm}&quot;
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </Button>
            </div>
          </div>
        ) : (
          <SidebarMenu className="gap-1">
            {filteredWorkloads?.map((workload) => {
              const UsecaseIcon = getUsecaseIcon(workload.usecase)
              return (
                <SidebarMenuItem key={workload.id} className="h-14">
                  <SidebarMenuButton
                    onClick={() => handleSelectWorkload(workload)}
                    isActive={activeWorkload?.id === workload.id}
                    className="hover:bg-sidebar-primary/5 data-[active=true]:bg-sidebar-primary/5 h-14 justify-start rounded-none"
                  >
                    <div className="bg-background flex h-9 w-9 items-center justify-center rounded-md border">
                      <UsecaseIcon strokeWidth={1.4} className="h-5 w-5" />
                    </div>
                    <div className="grid flex-1 gap-0.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-medium">
                          {workload.usecase.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className="max-w-[180px] truncate">
                          {workload.model.includes('/')
                            ? workload.model.split('/')[1]
                            : workload.model}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {workload.devices.map((device) => (
                            <Badge
                              key={device.id}
                              variant="outline"
                              className="h-4 px-1 py-0 text-[10px]"
                            >
                              {device.device}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover className="mt-3">
                        <MoreVertical className="h-4 w-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/workload/${workload.id}/edit`)
                        }
                      >
                        <SquarePen className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the workload.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive/90 text-destructive-foreground hover:bg-destructive"
                              onClick={() =>
                                handleDeleteWorkload(
                                  workload.id,
                                  workload.usecase,
                                )
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
