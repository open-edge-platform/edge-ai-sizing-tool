// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { Workload } from '@/payload-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PaginatedDocs } from 'payload'

export const useWorkload = (id: number) => {
  // Allow-list: Only allow positive integers as valid IDs
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid workload ID')
  }

  // Hardcode scheme & authority (allow-list)
  const path = `/api/workloads/${id}`

  // Basic check for path traversal attempts (../, //, whitespace, etc.)
  if (path.includes('..') || path.includes('//') || /\s/.test(path)) {
    throw new Error('Invalid characters in URL path')
  }

  return useQuery({
    queryKey: ['workloads', id],
    queryFn: async () => {
      const response = await fetch(path)
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    refetchInterval: 5000,
  })
}

export const useWorkloads = () => {
  return useQuery({
    queryKey: ['workloads'],
    queryFn: async (): Promise<PaginatedDocs<Workload>> => {
      const response = await fetch('/api/workloads?limit=0')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
  })
}

export const useCreateWorkload = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Workload>) => {
      const response = await fetch('/api/workloads', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create workload')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads'] })
    },
  })
}

export const useDeleteWorkload = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      // Validate: Only allow positive integers as valid IDs
     if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
        throw new Error('Invalid workload ID: must be a positive integer')
      }

      const id_str = id.toString()

      if (id_str.includes('..') || id_str.includes('//') || /\s/.test(id_str)) {
        throw new Error('Invalid characters in URL path')
      }

      const url = `/api/workloads/${id_str}`

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

        if (!response.ok) {
          // Try to parse error message, fallback to status text
          let errorMsg = 'Failed to delete workload'
          try {
            const error = await response.json()
            errorMsg = error.message || errorMsg
          } catch {
            errorMsg = response.statusText || errorMsg
          }
          throw new Error(errorMsg)
        }

        return await response.json()
    },
    onSuccess: () => {
      // Invalidate workloads query to refresh data
      queryClient.invalidateQueries({ queryKey: ['workloads'] })
    },
  })
}

export const useUpdateWorkload = (id: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Workload>) => {
      const response = await fetch('/api/workloads/' + id, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update workload')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads'] })
    },
  })
}
