// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useMutation } from '@tanstack/react-query'

export function useBatchProfile(port: number) {
  return useMutation({
    mutationFn: async (params: {
      selection_type?: 'pid' | 'appname'
      pid?: number
      app_name?: string
      app_path?: string
      duration?: number
    }) => {
      const response = await fetch(`/api/profile-batch?port=${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selection_type: params.selection_type || 'pid',
          pid: params.pid,
          app_name:
            params.app_name || (params.pid ? `pid_${params.pid}` : undefined),
          app_path: params.app_path,
          duration: params.duration || 30,
        }),
      })

      // Try to parse response body regardless of status
      let responseData
      try {
        responseData = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        // If parsing fails, throw with status info
        throw new Error(`HTTP ${response.status}: Failed to parse response`)
      }

      // Check if response was successful
      if (!response.ok) {
        // Extract error message from response data
        const errorMessage =
          responseData?.error ||
          responseData?.detail ||
          responseData?.message ||
          `HTTP ${response.status}: ${response.statusText}`

        console.error('Profiling API error:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        })

        throw new Error(errorMessage)
      }

      // Validate that we got actual profiling data
      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response format from profiling service')
      }

      return responseData
    },
  })
}
