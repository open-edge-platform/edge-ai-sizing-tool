// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET() {
    try {
        const { stdout } = await execAsync('v4l2-ctl --list-devices')
        const lines = stdout.split('\n').filter(line => line.trim() !== '')

        const devices: { [key: string]: number } = {}
        let currentDeviceName = ''
        let index = 0

        for (const line of lines) {
            if (!line.startsWith('\t')) {
                // Device name line
                currentDeviceName = line.trim()
                devices[currentDeviceName] = index++
            }
        }

        return new Response(JSON.stringify({ devices }), { status: 200 })
    } catch (err: unknown) {
        console.error(`Error executing command: ${err}`)
        return new Response(JSON.stringify({ devices: [] }), { status: 200 })
    }
}