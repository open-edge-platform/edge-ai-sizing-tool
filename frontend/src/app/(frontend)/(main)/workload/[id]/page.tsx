// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

'use client'

import { useRouter } from 'next/navigation'
import { Package, PackageX, PackageOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Text2Img } from '@/components/usecase/text2img'
import { TextGen } from '@/components/usecase/textgen'
import { Audio } from '@/components/usecase/audio'

import React from 'react'
import { useWorkload } from '@/hooks/useWorkload'
import { DlStreamer } from '@/components/usecase/dlstreamer'

// Workload type definition

export default function WorkloadPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const unwrappedParams = React.use(params)
  const workloadId = Number.parseInt(unwrappedParams.id)
  const { isLoading, data: workload } = useWorkload(Number(workloadId))

  // Render the appropriate usecase component
  const renderUsecaseComponent = () => {
    if (!workload) return null
    switch (workload.usecase) {
      case 'text-to-image':
        return <Text2Img workload={workload} />
      case 'text generation':
        return <TextGen workload={workload} />
      case 'automatic speech recognition':
        return <Audio workload={workload} />
      case 'object detection (DLStreamer)':
        return <DlStreamer workload={workload} />
      default:
        return (
          <div className="container py-10 text-center">
            <h1 className="text-2xl font-bold mb-4">Unsupported Workload Type</h1>
            <p className="text-muted-foreground mb-6">
              Current workload type is not supported by the current version.
            </p>
            <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
          </div>
        )
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className="container py-10 flex flex-col items-center justify-center">
          <Package strokeWidth={0.4} className="h-28 w-28 text-primary mb-4 animate-bounce" />
          <h2 className="text-xl font-medium mb-2">Loading Workload</h2>
          <p className="text-sm text-muted-foreground">Retrieving workload information...</p>
        </div>
      </>
    )
  }

  // No workload found (should be caught by error state, but just in case)
  if (!workload) {
    return (
      <>
        <div className="container py-10 flex flex-col items-center justify-center">
          <PackageX strokeWidth={0.4} className="h-28 w-28 text-primary mb-4" />
          <h2 className="text-xl font-medium mb-2">Workload Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The workload with ID {workloadId} does not exist.
          </p>
          <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
      </>
    )
  }

  if (workload.status === 'prepare') {
    return (
      <>
        <div className="container py-10 flex flex-col items-center justify-center">
          <PackageOpen strokeWidth={0.4} className="h-28 w-28 text-primary mb-4 animate-bounce" />
          <h2 className="text-xl font-medium mb-2">Preparing Workload</h2>
          <p className="text-sm text-muted-foreground">Preparing workload...</p>
        </div>
      </>
    )
  }

  if (workload.status === 'failed') {
    return (
      <>
        <div className="container py-10 flex flex-col items-center justify-center">
          <PackageX strokeWidth={0.4} className="h-28 w-28 text-primary mb-4" />
          <h2 className="text-xl font-medium mb-2">Workload Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The workload with ID {workloadId} has failed.
            You can either edit or delete the workload from the dashboard.
          </p>
          <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
      </>
    )
  }

  return (
    <div className="container flex flex-col h-full w-full mx-auto px-6">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto hide-scrollbar">
        <div className="flex justify-between items-center my-4">
          <div className="flex flex-col justify-left">
            <h1 className="text-lg font-bold capitalize">{workload.usecase.replace(/-/g, ' ')}</h1>
          </div>
        </div>

        <div className="container">
          {/* Usecase Component - Now the usecase component will handle its own performance metrics */}
          <div className="w-full">{renderUsecaseComponent()}</div>
        </div>
      </div>
    </div>
  )
}
