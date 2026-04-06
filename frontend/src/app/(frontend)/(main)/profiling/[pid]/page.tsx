// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApplicationProfiling } from '@/components/usecase/applicationprofiling'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, Download } from 'lucide-react'
import React from 'react'
import { Workload } from '@/payload-types'
import { exportWorkloadToPDF } from '@/lib/handleExportSnapshot'
import {
  useProfilingContext,
  ProfilingData,
} from '@/contexts/profiling-context'

export default function ProfilingResultsPage({
  params,
}: {
  params: Promise<{ pid: string }>
}) {
  const router = useRouter()
  const unwrappedParams = React.use(params)
  const pid = Number.parseInt(unwrappedParams.pid)
  const workloadRef = useRef<HTMLDivElement>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  // Get context data
  const { getProfilingSession, profilingData: contextData } =
    useProfilingContext()

  const [profilingData, setProfilingData] = useState<ProfilingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfilingData = () => {
      try {
        // Try to get from React Context
        const sessionFromContext = getProfilingSession(pid)
        if (sessionFromContext) {
          setProfilingData(sessionFromContext as ProfilingData)
          setIsLoading(false)
          return
        }

        // Check if current context data matches
        if (contextData && contextData.pid === pid) {
          setProfilingData(contextData as ProfilingData)
          setIsLoading(false)
          return
        }

        // Try sessionStorage for current session persistence on refresh
        const sessionData = sessionStorage.getItem(`profiling_${pid}`)

        if (sessionData) {
          const parsed = JSON.parse(sessionData)
          setProfilingData(parsed)
          setIsLoading(false)
          return
        }

        // No data found
        setError('Profiling data not found for this PID')
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to load profiling data:', err)
        setError('Failed to load profiling data')
        setIsLoading(false)
      }
    }

    if (!isNaN(pid) && pid > 0) {
      loadProfilingData()
    } else {
      setError('Invalid PID')
      setIsLoading(false)
    }
  }, [pid, getProfilingSession, contextData])

  const handleDownloadAnalysis = async () => {
    if (!profilingData) return

    try {
      setIsExportingPDF(true)
      await exportWorkloadToPDF({
        workloadID: profilingData.pid,
        workloadRef,
        router,
        isProfilingPage: true,
      })
    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export PDF')
    } finally {
      setIsExportingPDF(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading profiling results...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !profilingData) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-xl font-semibold">
            {error || 'No Profiling Data Found'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {error === 'Invalid PID'
              ? 'The provided PID is not valid.'
              : `No profiling data found for PID ${pid}. The session may have expired or been cleared.`}
          </p>
          <Button onClick={() => router.push('/workload/add')}>
            Start New Profiling
          </Button>
        </div>
      </div>
    )
  }

  const workload = {
    id: 0,
    task: 'custom application monitoring',
    usecase: 'custom application monitoring',
    model: '',
    devices: [],
    status: 'active',
    updatedAt: profilingData.timestamp,
    createdAt: profilingData.timestamp,
    metadata: {
      pid: profilingData.pid,
      processName: profilingData.processName,
      appName: profilingData.appName,
      duration: profilingData.duration,
      command: profilingData.command,
      profilingResults: profilingData.results,
      selectionType: profilingData.selectionType || 'pid',
    },
  } as Workload

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
              Custom Application Monitoring
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadAnalysis}
              className="exportBtn"
              disabled={isExportingPDF}
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="container">
          <div className="w-full">
            <ApplicationProfiling workload={workload} />
          </div>
        </div>
      </div>
    </div>
  )
}
