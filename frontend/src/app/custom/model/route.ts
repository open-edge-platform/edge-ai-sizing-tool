// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const baseDir = path.resolve(process.cwd(), '../custom_models')
    const result: { [key: string]: string[] } = {}
    try {
      const folders = fs.readdirSync(baseDir).filter((folder) => {
        const candidatePath = path.join(baseDir, folder)
        return fs.statSync(candidatePath.toString()).isDirectory()
      })
      folders.forEach((folder) => {
        const folderPath = path.join(baseDir, folder)
        const subfolders = fs
          .readdirSync(folderPath.toString())
          .filter((file) => {
            const filePath = path.join(folderPath, file)
            return fs.statSync(filePath.toString()).isDirectory()
          })
        result[folder] = subfolders
      })
      return NextResponse.json({ customModel: result })
    } catch (err) {
      console.error(`Error fetching model list from custom model folder:`, err)
      return NextResponse.json({ customModel: {} })
    }
  } catch (error) {
    let errorMessage = 'Failed to do something exceptional'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
