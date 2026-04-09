// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Workload } from '@/payload-types'
import { CollectionAfterChangeHook } from 'payload'
import {
  deleteWorkerProcess,
  startWorkerProcess,
  stopWorkerProcess,
} from '@/lib/processLib'
import { normalizeProcessName, normalizeUseCase } from '@/lib/utils'
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
  pid?: number
  processName?: string
  [key: string]: unknown
  repoPlatform?: string
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
  const newProcessName = `${normalizeUseCase(doc.usecase)}-${doc.id}`

  const prevProcessName =
    previousDoc && previousDoc.id
      ? previousDoc.usecase
        ? `${normalizeUseCase(previousDoc.usecase)}-${previousDoc.id}`
        : undefined
      : undefined

  if (previousDoc.status === 'active' && doc.status === 'inactive') {
    try {
      await stopWorkerProcess(newProcessName)
    } catch (error) {
      console.error(`Failed to stop worker process ${newProcessName}:`, error)
    }
  } else if (previousDoc.status === 'inactive' && doc.status === 'active') {
    try {
      await startWorkerProcess(newProcessName, '', '')
    } catch (error) {
      console.error(`Failed to start worker process ${newProcessName}:`, error)
    }
  } else if (doc.status === 'prepare') {
    if (
      operation === 'update' &&
      doc.id === previousDoc.id &&
      prevProcessName !== undefined
    ) {
      try {
        await stopWorkerProcess(prevProcessName)
        await deleteWorkerProcess(prevProcessName)
      } catch (error) {
        console.error(
          `Failed to stop/delete worker process ${prevProcessName}:`,
          error,
        )
      }
    }

    let params = ''
    let usecaseName = doc.usecase
    const metadata = doc.metadata as WorkloadMetadata | null

    if (doc.task === 'custom application monitoring') {
      usecaseName = 'custom-application-profiling'

      const pid = metadata?.pid
      if (!pid) {
        throw new Error(
          'metadata.pid is missing for custom application monitorin',
        )
      }
      const rawProcessName = metadata?.processName ?? ''
      const normalizedProcessName = normalizeProcessName(rawProcessName)
      const finalProcessName = normalizedProcessName || `pid_${pid}`

      params =
        `workload ` +
        `--pid ${pid} ` +
        `--port ${doc.port} ` +
        `--id ${doc.id} ` +
        `--name ${finalProcessName}`
    } else {
      const devicesName = doc.devices?.reduce((acc, device) => {
        const deviceName = device.device || ''
        if (acc === '') {
          return deviceName
        }

        return acc + ',' + deviceName
      }, '')

      const devices =
        doc.devices && doc.devices.length > 1
          ? `AUTO:${devicesName}`
          : devicesName

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

      const repoPlatform = metadata?.repoPlatform

      params =
        '--device ' +
        devices +
        ' --model ' +
        modelName +
        ' --port ' +
        doc.port +
        ' --id ' +
        doc.id

      if (typeof repoPlatform === 'string' && repoPlatform === 'modelscope') {
        params += ' --repo-source ' + repoPlatform
      }

      if (
        doc.usecase.includes('(DLStreamer') &&
        doc.source &&
        doc.source.name
      ) {
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
    }

    try {
      await startWorkerProcess(newProcessName, usecaseName, params)
    } catch (error) {
      console.error(`Failed to start worker process ${newProcessName}:`, error)
    }
  }
  return doc
}
