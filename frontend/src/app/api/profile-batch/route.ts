// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WORKLOAD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const WORKLOAD_FILE_RE =
  /^workload_([A-Za-z0-9_-]{1,128})_(status|results)\.json$/
const TRUSTED_BASE_DIR = fs.realpathSync(
  path.resolve(process.cwd(), '../workers/custom-application-profiling'),
)

type WorkloadFiles = {
  statusPath?: string
  resultsPath?: string
}

type PortValidationResult =
  | { ok: true; port: number }
  | { ok: false; message: string }

function isValidWorkloadId(value: string | null): value is string {
  return value !== null && WORKLOAD_ID_RE.test(value)
}

function isPathInsideBaseDir(baseDir: string, targetPath: string): boolean {
  const relativePath = path.relative(baseDir, targetPath)
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function isValidFilename(filename: string): boolean {
  // No path separators, no null bytes, no control characters
  return (
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('\0') &&
    !/[\x00-\x1f\x7f]/.test(filename) &&
    WORKLOAD_FILE_RE.test(filename)
  )
}

async function buildWorkloadPathIndex(): Promise<Map<string, WorkloadFiles>> {
  const entries = await fs.promises.readdir(TRUSTED_BASE_DIR, {
    withFileTypes: true,
  })
  const index = new Map<string, WorkloadFiles>()

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!isValidFilename(entry.name)) {
      continue
    }

    const match = WORKLOAD_FILE_RE.exec(entry.name)
    if (!match) {
      continue
    }
    const [, id, kind] = match
    const candidatePath = path.join(TRUSTED_BASE_DIR, entry.name)

    // Verify the joined path is still within the base directory
    if (
      !candidatePath.startsWith(TRUSTED_BASE_DIR + path.sep) &&
      candidatePath !== TRUSTED_BASE_DIR
    ) {
      continue
    }

    const resolvedPath = candidatePath

    // verify the path is within the base directory
    if (!isPathInsideBaseDir(TRUSTED_BASE_DIR, resolvedPath)) {
      continue
    }

    const current = index.get(id) ?? {}

    if (kind === 'status') {
      current.statusPath = resolvedPath
    } else if (kind === 'results') {
      current.resultsPath = resolvedPath
    }

    index.set(id, current)
  }

  return index
}

function validatePort(value: string | null): PortValidationResult {
  if (!value) {
    return { ok: false, message: 'Port parameter is missing' }
  }

  // Only decimal digits are allowed
  if (!/^\d{1,5}$/.test(value)) {
    return { ok: false, message: 'Invalid port. Only digits are allowed.' }
  }

  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: 'Invalid port. Port is out of range.' }
  }

  return { ok: true, port }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workloadId = searchParams.get('id')

    if (!isValidWorkloadId(workloadId)) {
      return NextResponse.json(
        { error: 'Invalid or missing workload ID format' },
        { status: 400 },
      )
    }

    const fileIndex = await buildWorkloadPathIndex()
    const workloadFiles = fileIndex.get(workloadId)

    if (!workloadFiles?.statusPath) {
      return NextResponse.json(
        {
          status: 'not_found',
          message: 'Workload not found',
        },
        { status: 404 },
      )
    }

    const statusContent = await fs.promises.readFile(
      workloadFiles.statusPath,
      'utf-8',
    )
    const status = JSON.parse(statusContent) as Record<string, unknown>

    if (status.status === 'completed' && workloadFiles.resultsPath) {
      const resultsContent = await fs.promises.readFile(
        workloadFiles.resultsPath,
        'utf-8',
      )
      const results = JSON.parse(resultsContent) as Record<string, unknown>

      return NextResponse.json({
        ...status,
        results,
      })
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to read workload status.', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to read workload status',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const portResult = validatePort(url.searchParams.get('port'))

    if (!portResult.ok) {
      return new Response(portResult.message, { status: 400 })
    }

    const body = await request.json()

    const apiURL = `http://127.0.0.1:${portResult.port}/api/profile-batch`

    // Validate the constructed URL
    const parsedURL = new URL(apiURL)

    // Ensure only localhost/loopback
    const allowedHosts = ['localhost', '127.0.0.1', '::1']
    if (!allowedHosts.includes(parsedURL.hostname)) {
      return new Response('Invalid host', { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      return new Response('Invalid protocol', { status: 400 })
    }

    if (!parsedURL.pathname.startsWith('/api/')) {
      return new Response('Invalid path', { status: 400 })
    }

    const urlPort = parseInt(parsedURL.port, 10)
    if (urlPort !== portResult.port || urlPort < 1 || urlPort > 65535) {
      return new Response('Invalid port', { status: 400 })
    }

    // Add timeout for long running profiling operations
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes timeout

    try {
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Try to get response data first
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError)

        if (response.ok) {
          return new Response(
            JSON.stringify({
              error: 'Invalid JSON response from profiling service',
              details:
                'The profiling service returned an invalid response format',
            }),
            {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // If response not OK and parsing failed return the status
        return new Response(
          JSON.stringify({
            error: `Backend error: ${response.status} ${response.statusText}`,
            status: response.status,
          }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // If response was not OK but got data check if its an error message
      if (!response.ok) {
        console.error('Backend error response:', data)
        return new Response(
          JSON.stringify({
            error: data.detail || data.message || 'Backend profiling error',
            status: response.status,
            details: data,
          }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return Response.json(data, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)

      // Check if it was a timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Profiling request timed out')
        return new Response(
          JSON.stringify({
            error: 'Profiling request timed out',
            details: 'The profiling operation took too long to complete',
          }),
          {
            status: 504,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Re-throw to be caught by outer catch
      throw fetchError
    }
  } catch (error) {
    console.error('Error connecting to batch profiling API:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = {
      error: 'Failed to connect to profiling service',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    }

    return new Response(JSON.stringify(errorDetails), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
