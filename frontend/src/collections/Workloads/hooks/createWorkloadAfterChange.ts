// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'
import { CollectionAfterChangeHook } from 'payload'
import { deletePm2Process, startPm2Process, stopPm2Process } from '@/lib/pm2Lib'
import { normalizeUseCase } from '@/lib/utils'
import path from 'path'

const ASSETS_PATH =
  process.env.ASSETS_PATH ?? path.join(process.cwd(), '../assets/media')
const MODELS_PATH =
  process.env.MODELS_PATH ?? path.join(process.cwd(), './models')

type WorkloadMetadata = {
  numStreams?: number
  customModel?: {
    name: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function isDLStreamerMetadata(metadata: unknown): metadata is WorkloadMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    typeof (metadata as { numStreams?: unknown }).numStreams === 'number'
  )
}

export const createWorkloadAfterChange: CollectionAfterChangeHook<
  Workload
> = async ({ doc, previousDoc, operation }) => {
  const newPm2Name = `${normalizeUseCase(doc.usecase)}-${doc.id}`
  const prevPm2Name =
    previousDoc && previousDoc.id && previousDoc.usecase
      ? `${normalizeUseCase(previousDoc.usecase)}-${previousDoc.id}`
      : undefined

  if (previousDoc.status === 'active' && doc.status === 'inactive') {
    await stopPm2Process(newPm2Name)
  } else if (previousDoc.status === 'inactive' && doc.status === 'active') {
    await startPm2Process(newPm2Name, '', '')
  } else if (doc.status === 'prepare') {
    if (
      operation === 'update' &&
      doc.id === previousDoc.id &&
      prevPm2Name !== undefined
    ) {
      await stopPm2Process(prevPm2Name)
      await deletePm2Process(prevPm2Name)
    }
    const devicesName = doc.devices.reduce((acc, device) => {
      const deviceName = device.device || ''
      if (acc === '') {
        return deviceName
      }

      return acc + ',' + deviceName
    }, '')

    const devices = doc.devices.length > 1 ? `AUTO:${devicesName}` : devicesName
    let usecaseName = doc.usecase
    const metadata = doc.metadata as WorkloadMetadata | null

    const hasCustomModel =
      doc.model === 'custom_model' &&
      metadata !== null &&
      typeof metadata === 'object' &&
      typeof metadata.customModel === 'object' &&
      metadata.customModel !== null &&
      'name' in metadata.customModel &&
      metadata.customModel.name

    const modelName =
      hasCustomModel && metadata && metadata.customModel
        ? path.join(MODELS_PATH, metadata.customModel.name)
        : doc.model

    let params =
      '--device ' +
      devices +
      ' --model ' +
      modelName +
      ' --port ' +
      doc.port +
      ' --id ' +
      doc.id
    if (doc.usecase.includes('(DLStreamer') && doc.source && doc.source.name) {
      if (doc.usecase === 'instance segmentation (DLStreamer)') {
        usecaseName = 'instance-segmentation'
      } else {
        usecaseName = 'dlstreamer'
      }

      if (doc.port) params += ' --tcp_port ' + (doc.port + 1000)
      if (doc.source.type !== 'cam') {
        params += ' --input ' + path.join(ASSETS_PATH, doc.source.name)
      } else {
        params += ' --input ' + doc.source.name
      }
      let numStreams: number | undefined = undefined
      if (isDLStreamerMetadata(doc.metadata)) {
        numStreams = doc.metadata.numStreams
      }

      if (typeof numStreams === 'number' && numStreams > 0) {
        params += ' --number_of_streams ' + numStreams
      }
    }
    await startPm2Process(newPm2Name, usecaseName, params)
  }
  return doc
}
