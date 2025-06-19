// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export async function GET(request: Request) {
  const url = new URL(request.url)
  const port = url.searchParams.get('port')

  if (!port) {
    return new Response('Port parameter is missing', { status: 400 })
  }

  if (!/^\d+$/.test(port)) {
    return new Response('Invalid port. Only digits are allowed.', {
      status: 400,
    })
  }

  const portNumber = parseInt(port, 10)
  if (portNumber < 1 || portNumber > 65535) {
    return new Response('Invalid port. Port is out of range.', { status: 400 })
  }

  // Hardcode scheme & authority
  // Disallow path traversal or whitespace in the port
  if (port.includes('..') || port.includes('//') || /\s/.test(port)) {
    return new Response('Invalid characters in port parameter.', {
      status: 400,
    })
  }

  // Build the safe URL
  const safeURL = `http://localhost:${portNumber}/result`

  try {
    const response = await fetch(safeURL)

    if (!response.body) {
      return new Response('No stream available from the target URL', {
        status: 500,
      })
    }

    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    })
  } catch (error) {
    return new Response(
      `Error connecting to localhost:${portNumber} - ${error}`,
      { status: 500 },
    )
  }
}
