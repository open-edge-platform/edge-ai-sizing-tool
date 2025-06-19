// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid' // Import the UUID package

const ASSETS_PATH = path.resolve(
  process.env.ASSETS_PATH ?? path.join(process.cwd(), '../assets/media'),
)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/mpeg',
  'video/ogg',
  'video/webm',
]
const ALLOWED_EXTENSIONS = [
  '.jpeg',
  '.jpg',
  '.png',
  '.mp4',
  '.mpeg',
  '.ogg',
  '.webm',
]

function getSecurePath(baseDir: string, filename: string): string | null {
  try {
    if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      console.error('Invalid filname format:', filename)
      return null
    }

    if (filename.includes('..') || path.isAbsolute(filename)) {
      console.error('Directory traversal attempt found')
      return null
    }

    const ext = path.extname(filename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      console.error('NOt allowed extension: ', ext)
      return null
    }

    const absBaseDir = path.resolve(baseDir)
    const finalPath = path.resolve(path.join(absBaseDir, filename))

    if (!finalPath.startsWith(absBaseDir)) {
      console.error('Path containment failed')
      return null
    }

    return finalPath
  } catch (err) {
    console.error('Path validation error:', err)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
      })
    }
    const sanitizedFileName = path.basename(file.name)
    if (!sanitizedFileName) {
      return new Response(JSON.stringify({ error: 'Invalid file name' }), {
        status: 400,
      })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
      })
    }

    const fileExtension = path.extname(sanitizedFileName).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file extension' }),
        { status: 400 },
      )
    }

    const uniqueFileName = `${uuidv4()}${fileExtension}`

    const securePath = getSecurePath(ASSETS_PATH, uniqueFileName)
    if (!securePath) {
      return new Response(JSON.stringify({ error: 'Path validation failed' }), {
        status: 400,
      })
    }

    const dir = path.dirname(securePath)
    try {
      await fs.promises.mkdir(dir, { recursive: true })
    } catch (err) {
      console.error('Failed to create directory:', err)
      return new Response(
        JSON.stringify({ error: 'Failed to create directory' }),
        { status: 500 },
      )
    }

    try {
      await fs.promises.writeFile(
        securePath,
        Buffer.from(await file.arrayBuffer()),
      )
    } catch (err) {
      console.error('Failed to write file:', err)
      return new Response(JSON.stringify({ error: 'Failed to write file' }), {
        status: 500,
      })
    }

    return new Response(JSON.stringify({ file: uniqueFileName }), {
      status: 200,
    })
  } catch (error) {
    console.error('File upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    })
  }
}
