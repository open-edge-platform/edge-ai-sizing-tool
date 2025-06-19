// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import os from 'os'

function bytesToGigabytes(bytes: number) {
  const gigabytes = bytes / 1024 ** 3
  return Math.round(gigabytes * 10) / 10 // Round to 1 decimal place
}

export async function GET() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const usedMemory = totalMemory - freeMemory
  const memoryUsage = (usedMemory / totalMemory) * 100

  const totalMemoryInGigabyte = bytesToGigabytes(totalMemory)

  return NextResponse.json({
    memoryUsage,
    total: totalMemoryInGigabyte,
  })
}
