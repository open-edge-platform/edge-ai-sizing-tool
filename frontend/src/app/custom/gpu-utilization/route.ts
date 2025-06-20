// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import si from 'systeminformation'
import os from 'os'

const isWindows = os.platform() === 'win32'

export async function GET() {
  try {
    if (isWindows) {
      const graphicsData = await si.graphics()
      const gpuUtilizations = graphicsData.controllers.map((controller) => ({
        device: controller.model,
        value: controller.utilizationGpu || 0
      }))

      return NextResponse.json({ gpuUtilizations })
    } else {
      const graphicsData = await si.graphics()
      const gpuUtilizations = graphicsData.controllers.map((controller) => ({
        device: controller.model,
        busaddr: controller.busAddress,
        value: null as number | null
      }))

      const osInfo = await si.osInfo()
      const promises = graphicsData.controllers.map((controller) => {
        return new Promise((resolve, reject) => {
          const busAddress = controller.busAddress
          if (!busAddress) {
            console.error('Bus address not found for controller:', controller.model)
            return resolve(0)
          }

          const formattedBusAddress = `pci:slot=0000:${busAddress}`

          const osVersion = osInfo.release.split(' ')[0] // Extract '24.04' part

          const commandArgs = osVersion.startsWith('24.04')
            ? ['-J', '-p', '-d', formattedBusAddress]
            : ['-J', '-d', formattedBusAddress]

          const process = spawn('intel_gpu_top', commandArgs)

          process.stderr.on('data', () => {
            const gpu = gpuUtilizations.find((gpu) => gpu.busaddr === controller.busAddress)
            if (gpu) {
              gpu.value = null
            }

            resolve(0)
            process.kill()
          })

          process.stdout.on('data', (data) => {
            if (data) {
              try {
                const jsonData = JSON.parse(data.toString().substring(1))
                let utilization = 0

                if (osVersion.startsWith('22.04')) {
                  // Check for Ubuntu 22.04
                  if (jsonData.engines['[unknown]/0']) {
                    utilization = jsonData.engines['[unknown]/0']['busy']
                  } else if (jsonData.engines['Compute/0']) {
                    utilization = jsonData.engines['Compute/0']['busy']
                  } else if (jsonData.engines['Render/3D/0']) {
                    utilization = jsonData.engines['Render/3D/0']['busy']
                  }
                } else {
                  // For Ubuntu 24.04 or other versions
                  if (jsonData.engines['Compute/0']) {
                    utilization = jsonData.engines['Compute/0']['busy']
                  } else if (jsonData.engines['Render/3D/0']) {
                    utilization = jsonData.engines['Render/3D/0']['busy']
                  }
                }

                const gpu = gpuUtilizations.find((gpu) => gpu.busaddr === controller.busAddress)
                if (gpu) {
                  gpu.value = utilization as number
                }

                resolve(utilization)
                process.kill()
              } catch (error) {
                console.error('Failed to parse JSON:', error)
                reject(error)
                process.kill()
              }
            }
          })

          process.on('error', (error) => {
            console.error('Failed to spawn process:', error)
            reject(error)
            process.kill()
          })
        })
      })

      await Promise.all(promises)
      return NextResponse.json({ gpuUtilizations })
    }
  } catch (error) {
    let errorMessage = 'Failed to do something exceptional'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
