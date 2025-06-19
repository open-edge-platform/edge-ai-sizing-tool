// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'

export default function useGetStreamMetricInterval(port: number, option = {}) {
  return useQuery({
    queryKey: ['fps', port],
    queryFn: async () => {
      const response = await fetch(`/api/stream/metrics?port=${port}`, {
        method: 'GET',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch FPS data')
      }

      const data = await response.json()

      return {
        ...data,
        timestamp: new Date(),
      }
    },
    refetchInterval: (query) => {
      return query.state.status === 'success' ? 1000 : false
    },
    retry: (failureCount: number): boolean => failureCount < 3,
    ...option,
  })
}
