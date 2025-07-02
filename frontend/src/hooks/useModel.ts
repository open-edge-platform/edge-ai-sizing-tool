// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useMutation, useQuery } from '@tanstack/react-query'

export const useUploadCustomModel = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/model', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to upload custom model')
      }

      return response.json()
    },
  })
}

export const useCustomModel = () => {
  return useQuery({
    queryKey: ['customModel'],
    queryFn: async () => {
      const response = await fetch('/custom/model')
      if (!response.ok) {
        throw new Error('Failed to fetch custom models')
      }
      const data = await response.json()
      return data.customModel || {}
    },
  })
}
