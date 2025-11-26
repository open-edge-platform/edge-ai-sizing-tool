// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import os from 'os'
import axios from 'axios'

const isWindows = os.platform() === 'win32'

export async function GET() {
  if (isWindows) {
    return Response.json({
      intervalUs: null,
      joulesConsumed: null,
    })
  }

  const apiURL = 'http://localhost:9738/persecond'

  try {
    const response = await axios.get(apiURL, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (response.status < 200 || response.status >= 300) {
      const errorText = JSON.stringify(response.data)
      throw new Error(
        `Backend responded with status ${response.status}: ${errorText}`,
      )
    }

    const data = response.data
    return Response.json({
      intervalUs: data['Interval us'],
      joulesConsumed:
        data['Uncore Aggregate']['Uncore Counters']['Package Joules Consumed'],
    })
  } catch (error) {
    console.error('Error fetching power metrics:', error)
    return new Response(
      `Failed to connect to power monitoring service: ${error}`,
      {
        status: 500,
      },
    )
  }
}
