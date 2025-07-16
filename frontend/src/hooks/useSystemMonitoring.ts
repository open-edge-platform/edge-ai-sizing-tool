// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'

export const useGetGPUs = () => {
  return useQuery({
    queryKey: ['gpus'],
    queryFn: async () => {
      const response = await fetch('/custom/gpu')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    retry: (failureCount: number): boolean => failureCount < 3,
  })
}

export const useCpuUtilization = () => {
  return useQuery({
    queryKey: ['cpuUtilization'],
    queryFn: async () => {
      const response = await fetch('/custom/cpu-utilization')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    refetchInterval: (query) => {
      return query.state.status === 'success' ? 3000 : false
    },
    retry: (failureCount: number): boolean => failureCount < 3,
  })
}

export const useMemoryUtilization = () => {
  return useQuery({
    queryKey: ['memoryUtilization'],
    queryFn: async () => {
      const response = await fetch('/custom/memory-utilization')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    refetchInterval: (query) => {
      return query.state.status === 'success' ? 3000 : false
    },
    retry: (failureCount: number): boolean => failureCount < 3,
  })
}

export const useGpuUtilization = (
  gpus: { device: string; busaddr: string }[],
) => {
  return useQuery({
    queryKey: ['gpuUtilization'],
    queryFn: async (): Promise<{
      gpuUtilizations: {
        device: string
        uuid: string | null
        value: number | null
      }[]
    }> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      try {
        const response = await fetch('/custom/gpu-utilization', {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gpus }),
        })
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        return response.json()
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            'Request timed out. Please refer to the troubleshooting guide.',
          )
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    },
    enabled: gpus.length > 0,
    refetchInterval: (query) => {
      return query.state.status === 'success' ? 3000 : false
    },
    retry: (failureCount: number): boolean => failureCount < 3,
  })
}

export const useNpuUtilization = () => {
  return useQuery({
    queryKey: ['npuUtilization'],
    queryFn: async () => {
      const response = await fetch('/custom/npu-utilization')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    refetchInterval: (query) => {
      return query.state.status === 'success' ? 3000 : false
    },
    retry: (failureCount: number): boolean => failureCount < 3,
  })
}
