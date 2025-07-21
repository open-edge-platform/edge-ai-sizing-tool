// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { deletePm2Process, stopPm2Process } from '@/lib/pm2Lib'
import { normalizeUseCase } from '@/lib/normalizeUsecase'
import { Workload } from '@/payload-types'
import { CollectionAfterDeleteHook } from 'payload'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Determine the platform
const isWindows = os.platform() === 'win32'

const ASSETS_PATH =
  process.env.ASSETS_PATH ?? path.join(process.cwd(), '../assets/media')
const MODELS_PATH =
  process.env.MODELS_PATH ?? path.join(process.cwd(), './models')

export const deleteWorkloadAfterDelete: CollectionAfterDeleteHook<
  Workload
> = async ({ doc }) => {
  const pm2Name = `${normalizeUseCase(doc.usecase)}-${doc.id}`
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
      const parts = candidatePath.split(path.sep).filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        if (!/^[\w.-]+$/.test(parts[i])) {
          console.error(`Rejecting invalid path segment: ${parts[i]}`)
          return doc
        }
      }
      const sanitizedCandidatePath = path.resolve(path.join(path.sep, ...parts))
      fs.rmSync(sanitizedCandidatePath, { force: true })
    }
  }

  type WorkloadMetadata = {
    numStreams?: number
    customModel?: {
      name: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }

  const metadata = doc.metadata as WorkloadMetadata | null

  const hasCustomModel =
    doc.model === 'custom_model' &&
    metadata !== null &&
    typeof metadata === 'object' &&
    typeof metadata.customModel === 'object' &&
    metadata.customModel !== null &&
    'name' in metadata.customModel &&
    metadata.customModel.name &&
    metadata.customModel.type === 'file'

  if (hasCustomModel) {
    const basePath = path.resolve(MODELS_PATH)
    const rawName = path.basename(metadata!.customModel!.name)
    const candidatePath = path.resolve(path.join(basePath, rawName)) // Zip file path
    const candidateExtractedPath = path.resolve(
      path.join(basePath, rawName.replace(/\.zip$/i, '')),
    ) // Extracted file path

    // Check if candidatePath and candidateExtractedPath are within our trusted directory
    if (
      !candidatePath.startsWith(basePath) ||
      !candidateExtractedPath.startsWith(basePath)
    ) {
      console.error(
        `Path traversal attempt detected: ${candidatePath} or ${candidateExtractedPath}`,
      )
      return doc
    }

    // Check the file name for only allowed characters
    if (!/^[a-zA-Z0-9._-]+$/.test(rawName)) {
      console.error(`Rejecting filename with invalid characters: ${rawName}`)
      return doc
    }

    // Ensure zip file exists before deleting
    if (fs.existsSync(candidatePath)) {
      // Break taint flow by splitting into segments and re-validating
      const parts = candidatePath.split(path.sep).filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        // Allow Windows drive letters (like "C:") only as the first segment and only on Windows
        if (i === 0 && isWindows && /^[A-Za-z]:$/.test(parts[i])) {
          continue
        }
        // Validate each segment for allowed characters
        if (!/^[\w.-]+$/.test(parts[i])) {
          console.error(`Rejecting invalid path segment: ${parts[i]}`)
          return doc
        }
      }
      const sanitizedCandidatePath = isWindows
        ? path.join(...parts)
        : path.resolve(basePath, ...parts)
      fs.rmSync(sanitizedCandidatePath)
    }

    if (fs.existsSync(candidateExtractedPath)) {
      // Break taint flow by splitting into segments and re-validating
      const parts = candidateExtractedPath.split(path.sep).filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        // Allow Windows drive letters (like "C:") only as the first segment and only on Windows
        if (i === 0 && isWindows && /^[A-Za-z]:$/.test(parts[i])) {
          continue
        }
        // Validate each segment for allowed characters
        if (!/^[\w.-]+$/.test(parts[i])) {
          console.error(`Rejecting invalid path segment: ${parts[i]}`)
          return doc
        }
      }
      const sanitizedExtractedPath = isWindows
        ? path.join(...parts)
        : path.resolve(basePath, ...parts)
      fs.rmSync(sanitizedExtractedPath, { recursive: true, force: true })
    }
  }

  // Delete PM2 processes after handling file deletion
  await stopPm2Process(pm2Name)
  await deletePm2Process(pm2Name)

  return doc
}
