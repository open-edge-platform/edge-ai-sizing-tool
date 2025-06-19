// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import WorkloadForm from '@/components/workload-form'
import { useWorkload } from '@/hooks/useWorkload'
import { useParams, useRouter } from 'next/navigation'

export default function EditWorkloadPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const { data: workload } = useWorkload(parseFloat(id))

  if (!id) {
    router.push('/')
    return
  }

  return <WorkloadForm workload={workload} />
}
