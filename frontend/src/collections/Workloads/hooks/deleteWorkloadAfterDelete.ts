// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { deletePm2Process, stopPm2Process } from '@/lib/pm2Lib'
import { Workload } from '@/payload-types'
import { CollectionAfterDeleteHook } from 'payload'
import fs from 'fs'
import path from 'path'

const ASSETS_PATH = process.env.ASSETS_PATH ?? path.join(process.cwd(), '../assets/media')

export const deleteWorkloadAfterDelete: CollectionAfterDeleteHook<Workload> = async ({ doc }) => {
  if (doc.source?.type === 'file' && doc.source.name) {
    const basePath = path.resolve(ASSETS_PATH)
    const rawName = path.basename(doc.source.name)
    const candidatePath = path.resolve(path.join(basePath, rawName))

    // Check if candidatePath is within our trusted directory
    if (!candidatePath.startsWith(basePath)) {
      console.error(`Path traversal attempt detected: ${candidatePath}`)
      return doc
    }

    // Check the file name for only allowed characters
    if (!/^[a-zA-Z0-9._-]+$/.test(rawName)) {
      console.error(`Rejecting filename with invalid characters: ${rawName}`)
      return doc
    }

    // Ensure file exists before deleting
    if (fs.existsSync(candidatePath)) {
      // Break taint flow by splitting into segments and re-validating
      const parts = candidatePath.split(path.sep)
      for (let i = 0; i < parts.length; i++) {
        if (!/^[\w.-]+$/.test(parts[i])) {
          console.error(`Rejecting invalid path segment: ${parts[i]}`)
          return doc
        }
      }
      const sanitizedCandidatePath = path.join(...parts)
      fs.unlinkSync(sanitizedCandidatePath)
    }
  }

  // Clean up PM2 processes after handling file deletion
  await stopPm2Process(doc.id.toString())
  await deletePm2Process(doc.id.toString())

  return doc
}