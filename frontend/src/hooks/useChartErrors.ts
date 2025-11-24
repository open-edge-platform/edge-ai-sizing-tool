// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0
import { useMemo } from 'react'
import {
  useCpuUtilization,
  useGpuUtilization,
  useMemoryUtilization,
  useNpuUtilization,
  useGpuMemory,
  useGPUXpum,
} from '@/hooks/useSystemMonitoring'

export function useChartErrors() {
  const { data: xpumData } = useGPUXpum()

  const cpuData = useCpuUtilization()
  const memoryData = useMemoryUtilization()
  const gpuData = useGpuUtilization(xpumData?.gpus || [])
  const npuData = useNpuUtilization()
  const gpuMemoryData = useGpuMemory(xpumData?.gpus || [])

  const hasErrors = useMemo(() => {
    // check for connection errors
    return (
      cpuData.error ||
      memoryData.error ||
      gpuData.error ||
      npuData.error ||
      gpuMemoryData.error
    )
  }, [
    cpuData.error,
    memoryData.error,
    gpuData.error,
    npuData.error,
    gpuMemoryData.error,
  ])

  const isLoading = useMemo(() => {
    return (
      cpuData.isLoading ||
      memoryData.isLoading ||
      gpuData.isLoading ||
      npuData.isLoading ||
      gpuMemoryData.isLoading
    )
  }, [
    cpuData.isLoading,
    memoryData.isLoading,
    gpuData.isLoading,
    npuData.isLoading,
    gpuMemoryData.isLoading,
  ])

  return {
    hasErrors,
    isLoading,
    errors: {
      cpu: cpuData.error,
      memory: memoryData.error,
      gpu: gpuData.error,
      npu: npuData.error,
      gpuMemory: gpuMemoryData.error,
    },
  }
}
