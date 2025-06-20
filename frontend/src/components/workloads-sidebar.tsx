// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

'use client'

import React, { useMemo, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  FileText,
  Image,
  MessageSquare,
  Mic,
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
  Video,
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

// Helper function to get icon based on usecase
const getUsecaseIcon = (usecase: string) => {
  switch (usecase) {
    case 'text-to-image':
      return Image
    case 'text-generation':
      return MessageSquare
    case 'automatic-speech-recognition':
      return Mic
    case 'object detection (DLStreamer)':
      return Video
    default:
      return FileText
  }
}

export function WorkloadsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
  const handleDeleteWorkload = async (id: number) => {
    try {
      const response = await deleteWorkload.mutateAsync(id)
      if (!response) {
        toast.error('Failed to delete workload')
        return
      }
      toast.success(`Workload ${id} deleted successfully`)
      if (pathname.split('/')[1] === 'workload' && currentPageID === id.toString()) {
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
          <div className="text-base font-medium text-foreground">Workloads</div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <SidebarInput
            placeholder="Search workloads"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          className="w-full flex items-center gap-2 justify-center"
          size="sm"
          onClick={() => router.push('/workload/add')}
        >
          <Plus className="h-4 w-4" />
          Add Workload
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {workloadsData.isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center mt-8">
            <Package strokeWidth={0.6} className="h-16 w-16 text-primary mb-4 animate-bounce" />
            <h3 className="font-medium mb-1">Loading workloads</h3>
            <p className="text-xs text-muted-foreground">Fetching your AI workloads...</p>
          </div>
        ) : workloadsData.isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ServerOff strokeWidth={0.6} className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Failed to load workloads</h3>
            <p className="text-xs text-muted-foreground mb-4">{workloadsData.error.message}</p>
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
              className="h-16 w-16 text-muted-foreground mb-2 opacity-30"
            />
            <h3 className="font-medium mb-1">No workloads created yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Get started by creating your first workload
            </p>
            <div className="space-y-4 max-w-xs">
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Click &quot;Add Workload&quot; above</p>
                  <p className="text-xs text-muted-foreground">To create a new workload</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">Configure your workload</p>
                  <p className="text-xs text-muted-foreground">
                    Choose task, usecase, model, and devices
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-left">
                <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">Deploy and run</p>
                  <p className="text-xs text-muted-foreground">
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
              className="h-16 w-16 text-muted-foreground mb-4 opacity-30"
            />
            <h3 className="font-medium mb-1">No matching workloads</h3>
            <p className="text-xs text-muted-foreground mb-4">
              No workloads match your search term &quot;{searchTerm}&quot;
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
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
                    className="justify-start h-14 rounded-none hover:bg-sidebar-primary/5 data-[active=true]:bg-sidebar-primary/5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                      <UsecaseIcon strokeWidth={1.4} className="h-5 w-5" />
                    </div>
                    <div className="grid flex-1 gap-0.5">
                      <div className=" items-center flex flex-wrap gap-1">
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 mr-1">
                          {workload.id}
                        </Badge>
                        <span className="font-medium">{workload.usecase.replace(/-/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate max-w-[180px]">
                          {workload.model.includes('/')
                            ? workload.model.split('/')[1]
                            : workload.model}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {workload.devices.map((device) => (
                            <Badge
                              key={device.id}
                              variant="outline"
                              className="text-[10px] px-1 py-0 h-4"
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
                        onClick={() => router.push(`/workload/${workload.id}/edit`)}
                      >
                        <SquarePen className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the
                              workload.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive/90 text-destructive-foreground hover:bg-destructive"
                              onClick={() => handleDeleteWorkload(workload.id)}
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
