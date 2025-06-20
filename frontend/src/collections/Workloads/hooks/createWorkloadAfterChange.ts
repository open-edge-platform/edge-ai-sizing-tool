// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { Workload } from '@/payload-types'
import { CollectionAfterChangeHook } from 'payload'
import { startPm2Process, stopPm2Process } from '@/lib/pm2Lib'
import path from 'path'
const ASSETS_PATH = process.env.ASSETS_PATH ?? path.join(process.cwd(), '../assets/media')

export const createWorkloadAfterChange: CollectionAfterChangeHook<Workload> = async ({
  doc,
  previousDoc,
}) => {
  if (previousDoc.status === 'active' && doc.status === 'inactive') {
    await stopPm2Process(doc.id.toString())
  } else if (previousDoc.status === 'inactive' && doc.status === 'active') {
    await startPm2Process(doc.id.toString(), '', '')
  } else if (doc.status === 'prepare') {
    const devicesName = doc.devices.reduce((acc, device) => {
      const deviceName = device.device || ''
      if (acc === '') {
        return deviceName
      }

      return acc + ',' + deviceName
    }, '')

    const devices = doc.devices.length > 1 ? `AUTO:${devicesName}` : devicesName
    let usecaseName = doc.usecase
    let params =
      '--device ' + devices + ' --model ' + doc.model + ' --port ' + doc.port + ' --id ' + doc.id
    if (doc.usecase.includes('(DLStreamer') && doc.source && doc.source.name) {
      usecaseName = 'dlstreamer'
      if (doc.port) params += ' --tcp_port ' + (doc.port + 1000)
      if (doc.source.type !== 'cam') {
        params += ' --input ' + path.join(ASSETS_PATH, doc.source.name)
      } else {
        params += ' --input ' + doc.source.name
      }
    }
    await startPm2Process(doc.id.toString(), usecaseName, params)
  } 

  return doc
}
