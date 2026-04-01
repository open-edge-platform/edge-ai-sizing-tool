// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Cpu,
  Microchip,
  Loader2,
  AppWindow,
  AlertCircle,
  HardDrive,
  AlertTriangle,
  Info,
  MemoryStick,
} from 'lucide-react'
import { Workload } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { useProfilingContext } from '@/contexts/profiling-context'

interface ProcessTreeNode {
  pid: number
  name: string
  cpu_percent?: number
  memory_mb?: number
  children?: ProcessTreeNode[]
  [key: string]: unknown
}

interface ProfileResults {
  application: {
    name: string
    command: string
    cpu_percent: number
    cpu_percent_normalized: number
    peak_cpu_percent_normalized: number
    memory_mb: number
    memory_percent: number
    peak_memory_mb: number
    gpu_compute_percent: number
    peak_gpu_compute_percent: number
    gpu_memory_mb: number
    gpu_memory_percent: number
    peak_gpu_memory_mb: number
    npu_percent: number
    peak_npu_percent: number
    disk_read_mb_per_sec: number
    disk_write_mb_per_sec: number
    peak_disk_read_mb_per_sec: number
    peak_disk_write_mb_per_sec: number
    process_tree: Record<string, ProcessTreeNode>
    [key: string]: unknown
  }
  baseline: {
    cpu_info: {
      model: string
      physical_cores: number
      logical_threads: number
    }
    cpu_percent: number
    gpu_devices: Array<{
      compute_percent: number
      [key: string]: unknown
    }>
    npu_percent: number
    [key: string]: unknown
  }
  bottleneck_analysis: {
    bottlenecks: Array<{
      resource: string
      severity: string
      description: string
      recommendations?: string[]
      confidence?: number
      metrics?: {
        [key: string]: unknown
      }
      [key: string]: unknown
    }>
    overall_score?: number
    overall_health?: string
    primary_bottleneck?: string | null
    summary?: string
    workload_type?: string
  }
  [key: string]: unknown
}

export function ApplicationProfiling({ workload }: { workload: Workload }) {
  const { profilingData, clearProfilingData } = useProfilingContext()
  const [batchResults, setBatchResults] = useState<ProfileResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Getting Confirmation from workload metadata
  const metadata = workload.metadata as Record<string, unknown> | undefined
  const pid = typeof metadata?.pid === 'number' ? metadata.pid : null

  useEffect(() => {
    const loadProfilingResults = () => {
      try {
        // try to get from workload metadata
        if (
          workload?.metadata &&
          typeof workload.metadata === 'object' &&
          'profilingResults' in workload.metadata
        ) {
          const results = (
            workload.metadata as { profilingResults: ProfileResults }
          ).profilingResults
          if (results) {
            setBatchResults(results)
            setError(null)
          }
        }
        // Fallback to context data if available
        else if (profilingData?.results) {
          setBatchResults(profilingData.results as ProfileResults)
          setError(null)
        } else {
          setError('Profiling results not available')
        }
      } catch (error) {
        console.error('Error loading profiling results:', error)
        setError('Failed to load profiling results')
      } finally {
        setIsLoading(false)
      }
    }

    loadProfilingResults()
  }, [workload, profilingData])

  // Clear profiling data when component unmounts
  useEffect(() => {
    return () => {
      clearProfilingData()
    }
  }, [clearProfilingData])

  const processTreeData: ProcessTreeNode[] = batchResults?.application
    ?.process_tree
    ? Object.values(batchResults.application.process_tree)
    : []

  // Get CPU info
  const cpuModel = batchResults?.baseline?.cpu_info?.model || 'Unknown CPU'
  const cpuCores = batchResults?.baseline?.cpu_info?.physical_cores || 0
  const cpuThreads = batchResults?.baseline?.cpu_info?.logical_threads || 0

  // Get bottleneck severity helpers
  const hasCritical = batchResults?.bottleneck_analysis?.bottlenecks?.some(
    (b) => b.severity === 'critical',
  )
  const hasSevere = batchResults?.bottleneck_analysis?.bottlenecks?.some(
    (b) => b.severity === 'severe',
  )
  const hasWarning = batchResults?.bottleneck_analysis?.bottlenecks?.some(
    (b) => b.severity === 'warning',
  )

  const hasModerate = batchResults?.bottleneck_analysis?.bottlenecks?.some(
    (b) => b.severity === 'moderate',
  )

  const hasWarningOrSevere = hasWarning || hasSevere || hasModerate

  // Get Bottleneck Arrays
  const criticalBottlenecks =
    batchResults?.bottleneck_analysis?.bottlenecks?.filter(
      (b) => b.severity === 'critical',
    ) || []

  const warningBottlenecks =
    batchResults?.bottleneck_analysis?.bottlenecks?.filter(
      (b) =>
        b.severity === 'warning' ||
        b.severity === 'severe' ||
        b.severity === 'moderate',
    ) || []

  // Get Primary bottleneck resource
  const primaryBottleneck =
    batchResults?.bottleneck_analysis?.bottlenecks?.[0]?.resource

  // Severity Status Text
  const severityStatus = hasCritical
    ? 'CRITICAL'
    : hasWarningOrSevere
      ? 'WARNING'
      : 'HEALTHY'

  // Get text color classes
  const textColorClass = hasCritical
    ? 'text-red-900'
    : hasWarningOrSevere
      ? 'text-yellow-900'
      : 'text-green-900'

  // Get badge color classes
  const badgeColorClass = hasCritical
    ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800'

  // Get Cards Classnames
  const getCardClassName = () => {
    if (hasCritical) {
      return 'border-red-200 bg-red-50'
    } else if (hasWarningOrSevere) {
      return 'border-yellow-200 bg-yellow-50'
    } else {
      return 'border-green-200 bg-green-50'
    }
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center p-8">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-600" />
        <h2 className="mb-2 text-xl font-semibold">
          Loading Profiling Results
        </h2>
        <p className="text-muted-foreground text-sm">
          Fetching performance metrics...
        </p>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center p-8">
        <AlertCircle className="mb-4 h-12 w-12 text-red-600" />
        <h2 className="mb-2 text-xl font-semibold">Error Loading Results</h2>
        <p className="text-muted-foreground mb-4 text-sm">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  // No results state
  if (!batchResults) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center p-8 text-center">
        <div className="bg-muted/50 mb-6 rounded-full p-6">
          <AppWindow className="text-muted-foreground h-12 w-12" />
        </div>
        <h2 className="mb-3 text-xl font-semibold">No Results Available</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Profiling results are not available yet. The profiling may still be in
          progress. Please refresh the page in a moment.
        </p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          {/* Header with title and button */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {/* Show PID as main title */}
                PID: {pid || 'Unknown'}
              </h1>

              <p className="text-muted-foreground mt-1 text-sm">
                {/* Show full command */}
                {batchResults.application.command && (
                  <>
                    <span className="font-mono text-xs">
                      {batchResults.application.command}
                    </span>
                    <br />
                  </>
                )}
                <br />
                Performance analysis based on{' '}
                {workload?.metadata &&
                typeof workload.metadata === 'object' &&
                'duration' in workload.metadata
                  ? `${(workload.metadata as { duration: number }).duration} second`
                  : 'configured'}{' '}
                profiling session
              </p>
            </div>
          </div>

          {/* Top Row -> System Info, Recommendations*/}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {/* CPU Info Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Information
                </CardTitle>
                <Cpu className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-gray-600">CPU Model</div>
                    <div className="text-md font-semibold">{cpuModel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Physical Cores</div>
                    <div className="text-md font-semibold">{cpuCores}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Logical Threads</div>
                    <div className="text-md font-semibold">{cpuThreads}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Analysis & Warnings */}
            <Card className={getCardClassName()}>
              <CardHeader>
                <CardTitle
                  className={`flex items-center gap-2 text-sm font-medium ${textColorClass}`}
                >
                  {hasCritical || hasSevere ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  Performance Analysis [{severityStatus}]
                  {primaryBottleneck && (
                    <span
                      className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColorClass}`}
                    >
                      {primaryBottleneck}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Critical Bottleneck */}
                {criticalBottlenecks.length > 0 && (
                  <div className="mb-4">
                    {criticalBottlenecks.map((bottleneck, index) => (
                      <div key={index} className="mb-3">
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="font-semibold text-red-900">
                            {bottleneck.resource} Bottleneck
                          </span>
                        </div>
                        {bottleneck.description && (
                          <p className="mb-2 ml-6 text-sm text-red-800">
                            {bottleneck.description}
                          </p>
                        )}
                        {bottleneck.recommendations &&
                          bottleneck.recommendations.length > 0 && (
                            <div className="ml-6">
                              <p className="mb-1 text-sm font-medium text-red-900">
                                Recommendations:
                              </p>
                              <ul className="list-disc space-y-1 pl-5">
                                {bottleneck.recommendations.map(
                                  (rec, recIndex) => (
                                    <li
                                      key={recIndex}
                                      className="text-sm text-red-800"
                                    >
                                      {rec}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Display Warning Bottleneck */}
                {warningBottlenecks.length > 0 && (
                  <div className="mb-4">
                    {warningBottlenecks.map((bottleneck, index) => (
                      <div key={index} className="mb-3">
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="font-semibold text-yellow-900">
                            {bottleneck.resource}
                          </span>
                        </div>
                        {bottleneck.description && (
                          <p className="mb-2 ml-6 text-sm text-yellow-800">
                            {bottleneck.description}
                          </p>
                        )}
                        {bottleneck.recommendations &&
                          bottleneck.recommendations.length > 0 && (
                            <div className="ml-6">
                              <p className="mb-1 text-sm font-medium text-yellow-900">
                                Recommendations:
                              </p>
                              <ul className="list-disc space-y-1 pl-5">
                                {bottleneck.recommendations.map(
                                  (rec, recIndex) => (
                                    <li
                                      key={recIndex}
                                      className="text-sm text-yellow-800"
                                    >
                                      {rec}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Display summary if no bottleneck */}
                {criticalBottlenecks.length === 0 &&
                  warningBottlenecks.length === 0 && (
                    <div className="mb-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-green-900">
                          System Status
                        </span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {batchResults.bottleneck_analysis?.bottlenecks &&
                        batchResults.bottleneck_analysis.bottlenecks.length >
                          0 ? (
                          <>
                            {batchResults.bottleneck_analysis.bottlenecks.map(
                              (bottleneck, index) => (
                                <p
                                  key={index}
                                  className="text-sm text-green-800"
                                >
                                  {bottleneck.description}
                                </p>
                              ),
                            )}
                          </>
                        ) : (
                          // Fallback if no bottlenecks at all
                          <p className="text-sm text-green-800">
                            No performance issues detected
                          </p>
                        )}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* 2nd Row -> Baseline, CPU, GPU, NPU */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            {/* Baseline */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Baseline Resource Utilization
                </CardTitle>
                <Info className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-muted-foreground mb-1 text-xs">
                      CPU
                    </div>
                    <div className="text-lg font-semibold text-gray-700">
                      {batchResults.baseline.cpu_percent?.toFixed(1) || '0.0'}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground mb-1 text-xs">
                      GPU
                    </div>
                    <div className="text-lg font-semibold text-gray-700">
                      {batchResults.baseline.gpu_devices?.[0]?.compute_percent?.toFixed(
                        1,
                      ) || '0.0'}
                      %
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground mb-1 text-xs">
                      NPU
                    </div>
                    <div className="text-lg font-semibold text-gray-700">
                      {batchResults.baseline.npu_percent?.toFixed(1) || '0.0'}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CPU Usage Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Average
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {batchResults.application.cpu_percent_normalized.toFixed(
                        1,
                      )}
                      %
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Peak
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {batchResults.application.peak_cpu_percent_normalized.toFixed(
                        1,
                      )}
                      %
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPU Usage Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">GPU Usage</CardTitle>
                <Microchip className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Average
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {batchResults.application.gpu_compute_percent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Peak
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {batchResults.application.peak_gpu_compute_percent.toFixed(
                        1,
                      )}
                      %
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NPU Usage Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPU Usage</CardTitle>
                <Microchip className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Average
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {batchResults.application.npu_percent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">
                      Peak
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {batchResults.application.peak_npu_percent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3rd Row -> I/O*/}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {/* I/O Statistic Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  I/O Statistics
                </CardTitle>
                <HardDrive className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">Read</span>
                      <span className="text-lg font-bold">
                        {batchResults.application.disk_read_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Peak:{' '}
                        {batchResults.application.peak_disk_read_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                      <span className="text-muted-foreground">
                        Avg:{' '}
                        {batchResults.application.disk_read_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">Write</span>
                      <span className="text-lg font-bold">
                        {batchResults.application.disk_write_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Peak:{' '}
                        {batchResults.application.peak_disk_write_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                      <span className="text-muted-foreground">
                        Avg:{' '}
                        {batchResults.application.disk_write_mb_per_sec.toFixed(
                          1,
                        )}{' '}
                        MB/s
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Memory Usage
                </CardTitle>
                <MemoryStick className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        System Memory
                      </span>
                      <span className="text-lg font-bold">
                        {batchResults.application.memory_mb.toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Peak:{' '}
                        {batchResults.application.peak_memory_mb.toFixed(1)} MB
                      </span>
                      <span className="text-muted-foreground">
                        {batchResults.application.memory_percent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">GPU Memory</span>
                      <span className="text-lg font-bold">
                        {batchResults.application.gpu_memory_mb.toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Peak:{' '}
                        {batchResults.application.peak_gpu_memory_mb.toFixed(1)}{' '}
                        MB
                      </span>
                      <span className="text-muted-foreground">
                        {batchResults.application.gpu_memory_percent?.toFixed(
                          2,
                        ) || '0.00'}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row -> Processes */}
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Processes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-muted-foreground grid grid-cols-4 gap-4 border-b pb-2 text-xs font-medium uppercase">
                    <div>Process Name</div>
                    <div>PID</div>
                    <div>CPU Usage</div>
                    <div>Memory Usage</div>
                  </div>
                  {processTreeData.slice(0, 5).map((proc) => (
                    <div
                      key={proc.pid}
                      className="grid grid-cols-4 gap-4 border-b py-2 text-sm last:border-0"
                    >
                      <div className="truncate font-medium">{proc.name}</div>
                      <div className="text-muted-foreground">{proc.pid}</div>
                      <div>{proc.cpu_percent?.toFixed(2) || '0.00'}%</div>
                      <div>{proc.memory_mb?.toFixed(1) || '0.0'} MB</div>
                    </div>
                  ))}
                  {processTreeData.length === 0 && (
                    <div className="text-muted-foreground py-4 text-center text-sm">
                      No process data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
