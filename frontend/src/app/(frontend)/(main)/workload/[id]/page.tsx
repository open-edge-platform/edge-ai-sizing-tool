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
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import SystemInformationPage from '@/app/(frontend)/(main)/system/information/page'

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
  const systemInfoRef = useRef<HTMLDivElement>(null)
  const [showSystemInfo, setShowSystemInfo] = useState(false)

  const handleExportPDF = async () => {
    setShowSystemInfo(true)
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))
    const workloadCanvas = await html2canvas(workloadRef.current!, {
      useCORS: true,
      scale: 3,
    })
    const workloadImg = workloadCanvas.toDataURL('image/jpeg')

    const sysInfoCanvas = await html2canvas(systemInfoRef.current!, {
      useCORS: true,
      scale: 3,
    })
    const sysInfoImg = sysInfoCanvas.toDataURL('image/jpeg')

    setShowSystemInfo(false)

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: 'a4',
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    let imgProps = pdf.getImageProperties(workloadImg)
    let imgHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(workloadImg, 'JPEG', 0, 0, pdfWidth, imgHeight)

    pdf.addPage()

    imgProps = pdf.getImageProperties(sysInfoImg)
    imgHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(sysInfoImg, 'JPEG', 0, 0, pdfWidth, imgHeight)
    pdf.save(
      `workload-ID(${workloadId})-${new Date().toISOString().slice(0, 10)}.pdf`,
    )
  }

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
      case 'text-to-speech':
        return <Text2Speech workload={workload} />
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
    <div
      ref={workloadRef}
      className="container mx-auto flex h-full w-full flex-col px-6"
    >
      {showSystemInfo && (
        <div
          ref={systemInfoRef}
          className="absolute top-0 left-[-9999px] w-[1122px]"
          aria-hidden="true"
        >
          <SystemInformationPage />
        </div>
      )}
      {/* Scrollable Content Area */}
      <div className="hide-scrollbar flex-1 overflow-auto">
        <div className="my-4 flex items-center justify-between">
          <div className="justify-left flex flex-col">
            <h1 className="text-lg font-bold capitalize">
              {workload.usecase.replace(/-/g, ' ')}
            </h1>
          </div>
          <Button onClick={handleExportPDF}>Export as PDF</Button>
        </div>

        <div className="container">
          {/* Usecase Component - Now the usecase component will handle its own performance metrics */}
          <div className="w-full">{renderUsecaseComponent()}</div>
        </div>
      </div>
    </div>
  )
}
