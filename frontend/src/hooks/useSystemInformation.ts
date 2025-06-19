// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'

export const useSystemInfo = () => {
  return useQuery({
    queryKey: ['systemInfo'],
    queryFn: async () => {
      try {
        const response = await fetch(`/custom/system-information`)
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        return response.json()
      } catch (error) {
        console.error('Error fetching system information', error)
        throw new Error('Failed to retrieve system information')
      }
    },
    refetchInterval: 5000,
  })
}
