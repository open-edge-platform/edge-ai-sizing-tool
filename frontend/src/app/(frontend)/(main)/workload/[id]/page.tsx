/* eslint-disable prettier/prettier */
// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useRouter } from 'next/navigation'
import { Package, PackageX, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Text2Img } from '@/components/usecase/text2img'
import { TextGen } from '@/components/usecase/textgen'
import { Audio } from '@/components/usecase/audio'
import { Text2Speech } from '@/components/usecase/text2speech'
import React, { useRef, useState } from 'react'
import { useWorkload } from '@/hooks/useWorkload'
import { DlStreamer } from '@/components/usecase/dlstreamer'
import { exportWorkloadToPDF } from '@/lib/handleExportSnapshot'
import { useTrimmedUtilization, useProcessedSystemInfo, exportToExcel } from '@/lib/handleExportExcel'
import { normalizeUseCase } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { TextToImagePerformanceMetrics } from '@/types/text2img-types'
import { TextGenerationPerformanceMetrics } from '@/types/textgen-types'
import { AudioPerformanceMetrics } from '@/types/audio-types'
import { DlStreamerPerformanceMetrics } from '@/types/dlstreamer-types'
import { TtsPerformanceMetrics } from '@/types/text2speech-types'
import { useChartErrors } from '@/hooks/useChartErrors'

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
  const workloadRef = useRef<HTMLDivElement>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const { utilizationInfo } = useTrimmedUtilization()
  const { sysInfo } = useProcessedSystemInfo()
  const [performanceMetrics, setPerformanceMetrics] = useState<TextToImagePerformanceMetrics | TextGenerationPerformanceMetrics | AudioPerformanceMetrics | DlStreamerPerformanceMetrics | TtsPerformanceMetrics | null>(null)

  const { hasErrors, isLoading: chartsLoading } = useChartErrors()

  const handleExportPDF = async () => {
    if (isExportingPDF || !workload) return

    try {
      setIsExportingPDF(true)
      await exportWorkloadToPDF({
        workloadId,
        workloadRef,
        router,
      })
    } catch (error) {
      console.error('Export failed:', error)
      setIsExportingPDF(false)
    } finally {
      setIsExportingPDF(false)
    }
  }

  const handleExportExcel = async () => {
    if (isExportingExcel || !workload) return

    try {
      setIsExportingExcel(true)

      const workloadInfo = {
        id: Number(workload.id),
        name: normalizeUseCase(workload.usecase) + '-' + workload.id,
        model: workload.model.split('/').length > 1
        ? workload.model.split('/')[1]
        : workload.model,
        devices: workload.devices,
        performanceMetrics: performanceMetrics,
      }

      if (sysInfo && utilizationInfo && workloadInfo) {
        exportToExcel(sysInfo, utilizationInfo, workloadInfo)
      } else {
        console.error('System Info is not available for export.')
      }
    } catch (error) {
      console.error('Export failed:', error)
      setIsExportingExcel(false)
    } finally {
      setIsExportingExcel(false)
    }
  }

  // Render the appropriate usecase component
  const renderUsecaseComponent = () => {
    if (!workload) return null
    switch (workload.usecase) {
      case 'text-to-image':
        return <Text2Img workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
      case 'text generation':
        return <TextGen workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
      case 'automatic speech recognition':
        return <Audio workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
      case 'object detection (DLStreamer)':
        return <DlStreamer workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
      case 'instance segmentation (DLStreamer)':
        return <DlStreamer workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
      case 'text-to-speech':
        return <Text2Speech workload={workload} setPerformanceMetrics={setPerformanceMetrics} />
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

  // determine if export button needs to be shown
  const showExportButtonCheck = !hasErrors && !chartsLoading

  return (
    <div
      ref={workloadRef}
      className="container mx-auto flex h-full w-full flex-col px-6"
    >
      {/* Scrollable Content Area */}
      <div className="hide-scrollbar flex-1 overflow-auto">
        <div className="my-4 flex items-center justify-between">
          <div className="justify-left flex flex-col">
            <h1 className="text-lg font-bold capitalize">
              {workload.usecase.replace(/-/g, ' ')}
            </h1>
          </div>
          {showExportButtonCheck && (
            <div className="flex gap-2">
              <Button onClick={handleExportExcel} disabled={isExportingExcel} className="exportBtn">
                  {isExportingExcel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    'Export as Excel'
                  )}
              </Button>
              <Button onClick={handleExportPDF} disabled={isExportingPDF} className="exportBtn">
                {isExportingPDF ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  'Export as PDF'
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="container">
          {/* Usecase Component - Now the usecase component will handle its own performance metrics */}
          <div className="w-full">{renderUsecaseComponent()}</div>
        </div>
      </div>
    </div>
  )
}
