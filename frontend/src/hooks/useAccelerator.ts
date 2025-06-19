// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'

export const useAccelerator = () => {
  return useQuery({
    queryKey: ['accelerators'],
    queryFn: async () => {
      const response = await fetch('/custom/accelerator')
      if (!response.ok) {
        throw new Error('Failed to fetch accelerators')
      }
      const data = await response.json()
      return data.devices ? data : { devices: [] } // Ensure devices is always defined
    },
  })
}
