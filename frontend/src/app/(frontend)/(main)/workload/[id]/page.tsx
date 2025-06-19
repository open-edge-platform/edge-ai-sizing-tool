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

export default function WorkloadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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
            <h1 className="mb-4 text-2xl font-bold">
              Unsupported Workload Type
            </h1>
            <p className="text-muted-foreground mb-6">
              Current workload type is not supported by the current version.
            </p>
            <Button onClick={() => router.push('/')}>
              Return to Dashboard
            </Button>
          </div>
        )
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className="container flex flex-col items-center justify-center py-10">
          <Package
            strokeWidth={0.4}
            className="text-primary mb-4 h-28 w-28 animate-bounce"
          />
          <h2 className="mb-2 text-xl font-medium">Loading Workload</h2>
          <p className="text-muted-foreground text-sm">
            Retrieving workload information...
          </p>
        </div>
      </>
    )
  }

  // No workload found (should be caught by error state, but just in case)
  if (!workload) {
    return (
      <>
        <div className="container flex flex-col items-center justify-center py-10">
          <PackageX strokeWidth={0.4} className="text-primary mb-4 h-28 w-28" />
          <h2 className="mb-2 text-xl font-medium">Workload Not Found</h2>
          <p className="text-muted-foreground mb-6 text-sm">
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
        <div className="container flex flex-col items-center justify-center py-10">
          <PackageOpen
            strokeWidth={0.4}
            className="text-primary mb-4 h-28 w-28 animate-bounce"
          />
          <h2 className="mb-2 text-xl font-medium">Preparing Workload</h2>
          <p className="text-muted-foreground text-sm">Preparing workload...</p>
        </div>
      </>
    )
  }

  if (workload.status === 'failed') {
    return (
      <>
        <div className="container flex flex-col items-center justify-center py-10">
          <PackageX strokeWidth={0.4} className="text-primary mb-4 h-28 w-28" />
          <h2 className="mb-2 text-xl font-medium">Workload Failed</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            The workload with ID {workloadId} has failed. You can either edit or
            delete the workload from the dashboard.
          </p>
          <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
      </>
    )
  }

  return (
    <div className="container mx-auto flex h-full w-full flex-col px-6">
      {/* Scrollable Content Area */}
      <div className="hide-scrollbar flex-1 overflow-auto">
        <div className="my-4 flex items-center justify-between">
          <div className="justify-left flex flex-col">
            <h1 className="text-lg font-bold capitalize">
              {workload.usecase.replace(/-/g, ' ')}
            </h1>
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
