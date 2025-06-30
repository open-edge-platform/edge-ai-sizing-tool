import si from 'systeminformation'
import { NextResponse } from 'next/server'

export async function GET() {
  const graphicsData = await si.graphics()
  const gpuData = graphicsData.controllers.map((controller) => ({
    device: controller.model,
    busaddr: controller.busAddress,
  }))
  return NextResponse.json({ gpus: gpuData })
}
