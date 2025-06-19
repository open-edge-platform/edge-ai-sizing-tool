// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'

export default function useGetDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await fetch('/api/devices')
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}
