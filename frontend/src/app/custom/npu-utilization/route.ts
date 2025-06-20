// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { NextResponse } from 'next/server'
import { addon as ov } from 'openvino-node'
import { NOT_AVAILABLE } from '@/lib/constants'

export async function GET() {
    const core = new ov.Core()
    const available_devices = core.getAvailableDevices()

    let deviceName = NOT_AVAILABLE

    for (const device of available_devices) {
        if (device.startsWith("NPU")) {
            deviceName = String(core.getProperty(device, "FULL_DEVICE_NAME"))
        }
    }

    return NextResponse.json({ name: deviceName, value: null })

}