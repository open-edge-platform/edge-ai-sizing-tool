// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

async function readLastLines(filePath: string, lines = 50) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n').slice(-lines).join('\n')
  } catch {
    return null
  }
}

async function dirExists(dir: string) {
  try {
    const stat = await fs.stat(dir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const identifier = searchParams.get('id')

  if (!identifier) {
    return NextResponse.json(
      { error: 'Missing workload identifier' },
      { status: 400 },
    )
  }

  try {
    const logDir = path.join(process.cwd(), '.logs')

    if (!(await dirExists(logDir))) {
      return NextResponse.json(
        { error: 'Log directory not found.' },
        { status: 404 },
      )
    }

    const outLogPath = path.join(logDir, `${identifier}-out.log`)
    const errLogPath = path.join(logDir, `${identifier}-error.log`)

    const outLog =
      (await readLastLines(outLogPath)) || 'No output log available.'
    const errLog =
      (await readLastLines(errLogPath)) || 'No error log available.'

    const combinedLogs =
      `----- OUTPUT LOG (${outLogPath}) -----\n${outLog}\n\n` +
      `----- ERROR LOG (${errLogPath}) -----\n${errLog}`

    return NextResponse.json({ logs: combinedLogs })
  } catch (err) {
    return NextResponse.json(
      {
        error: `Unable to read log files: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    )
  }
}
