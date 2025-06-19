// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from 'next/server'

/**
 * API route handler for inference responses.
 *
 * This function handles POST requests to infer a response using an exposed service.
 * It forwards the request data to the service and returns the infer response.
 * In case of errors, it returns appropriate error messages and status codes.
 *
 * @param req - The incoming Next.js request object.
 * @returns A NextResponse object containing the inferred response or an error message.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const port = data?.port

    if (!port) {
      return new Response('Port parameter is missing', { status: 400 })
    }

    const portStr = String(port)
    if (!/^\d+$/.test(portStr)) {
      return new Response('Invalid port. Only digits are allowed.', {
        status: 400,
      })
    }

    if (
      portStr.includes('..') ||
      portStr.includes('//') ||
      /\s/.test(portStr)
    ) {
      return new Response('Invalid characters in port parameter.', {
        status: 400,
      })
    }

    const portNumber = parseInt(port, 10)
    if (portNumber < 1 || portNumber > 65535) {
      return new Response('Invalid port. Port is out of range.', {
        status: 400,
      })
    }

    const inferURL = `http://localhost:${portNumber}/infer`

    const response = await fetch(inferURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    const result = await response.json()
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to infer response' },
        { status: response.status },
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('An error occurred while infer a response:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    )
  }
}
