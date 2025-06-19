// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Cpu, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Workload } from '@/payload-types'
import { Switch } from '@/components/ui/switch'
import { useUpdateWorkload } from '@/hooks/useWorkload'
import { useAccelerator } from '@/hooks/useAccelerator'
import { toast } from 'sonner'

export function WorkloadProfile({ workload }: { workload: Workload }) {
  const updateWorkload = useUpdateWorkload(workload.id)
  const { data: deviceDetails } = useAccelerator()
  const acceleratorDevices: { id: string; name?: string }[] | undefined =
    deviceDetails?.devices
  // Format relative time (e.g., "2 hours ago")
  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch (error: unknown) {
      console.log(error)
      return 'Unknown time'
    }
  }

  const onStatusChange = (newStatus: string) => {
    try {
      updateWorkload.mutate(
        { ...workload, status: newStatus === 'active' ? 'prepare' : newStatus },
        {
          onError: (error) => {
            toast.error('Error updating workload status')
            console.error('Error updating workload status:', error)
          },
        },
      )
    } catch (error) {
      toast.error('Failed to update workload status')
      console.error('Failed to update workload status:', error)
    }
  }

  return (
    <Card className="h-full min-h-[500px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Workload Details</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={workload.status === 'active'}
                onCheckedChange={(checked) =>
                  onStatusChange(checked ? 'active' : 'inactive')
                }
                className="py-0.5"
              />
              <span className="text-sm">{workload.status}</span>
              <Badge variant="secondary" className="px-2 py-0.5">
                ID: {workload.id}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="bg-muted/40 flex items-center gap-2 rounded-md p-2">
              <div className="min-w-24 text-sm font-medium">Model</div>
              <div className="flex-1 font-mono text-sm">
                {workload.model.split('/').length > 1
                  ? workload.model.split('/')[1]
                  : workload.model}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4" />
              Allocated Devices
            </h3>
            <div className="flex flex-wrap gap-2">
              {workload.devices.map((device) => {
                const deviceDetails = acceleratorDevices?.find(
                  (d) => d.id === device.device,
                )
                const deviceName = deviceDetails?.name || 'NA'
                return (
                  <TooltipProvider key={device.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex cursor-help items-center gap-2 rounded-md border p-2 text-sm">
                          <Cpu className="text-muted-foreground h-4 w-4" />
                          <span>{device.device}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Device ID: {device.id}</p>
                        <p>Device Name: {deviceName}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground">Last Updated</div>
              <div className="font-medium">
                {getRelativeTime(workload.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
