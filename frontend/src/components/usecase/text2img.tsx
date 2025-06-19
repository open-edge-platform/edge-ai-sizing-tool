// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useState } from 'react'
import { Image as ImageIcon, Download, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Workload } from '@/payload-types'
import { useInfer } from '@/hooks/use-infer'
import { WorkloadProfile } from '@/components/workload-profile'
import { PerformanceMetrics } from '@/components/performance-metrics'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { toast } from 'sonner'

export interface TextToImageMessage {
  port: number
  prompt: string
  inference_step: number
  image_width: number
  image_height: number
}

interface TextToImageResult {
  generation_time_s: number
  image: string
}

interface Text2ImgProps {
  workload: Workload
}

function calculateThroughput(
  imageSize: string,
  generationTime: number,
): number {
  if (generationTime <= 0) {
    return 0 // Avoid division by zero or negative time
  }

  const [width, height] = imageSize.split('x').map(Number)
  if (isNaN(width) || isNaN(height)) {
    throw new Error(
      "Invalid image size format. Expected format 'widthxheight'.",
    )
  }

  const totalPixels = width * height
  return totalPixels / generationTime // Pixels per second
}

export function Text2Img({ workload }: Text2ImgProps) {
  const { inferResponse, isInferencing } = useInfer()
  const [textPrompt, setTextPrompt] = useState<string>(
    'masterpiece, high quality, a street, flowers, trees, anime',
  )
  const [result, setResult] = useState<TextToImageResult | null>(null)
  const [imageSize, setImageSize] = useState<string>('512x512')
  const [inferenceSteps, setInferenceSteps] = useState<number>(25)
  const [metrics, setMetrics] = useState<{
    generation_time_s: number
    throughput_s: number
  } | null>(
    result
      ? {
          generation_time_s: result.generation_time_s || 0,
          throughput_s:
            imageSize
              .split('x')
              .reduce((a, b) => Number(a) * Number(b as unknown as number), 1) /
              result.generation_time_s || 0,
        }
      : {
          generation_time_s: 0,
          throughput_s: 0,
        },
  )
  const [previousMetrics, setPreviousMetrics] = useState<{
    generation_time_s: number
    throughput_s: number
  } | null>(null)

  const handleGenerate = async () => {
    const [imageWidth, imageHeight] = imageSize.split('x').map(Number)
    if (!prompt || !inferenceSteps || !imageHeight || !imageWidth) {
      console.error('Missing parameters')
      return
    }

    try {
      const message: TextToImageMessage = {
        port: workload?.port as number,
        prompt: textPrompt,
        inference_step: inferenceSteps,
        image_width: imageWidth,
        image_height: imageHeight,
      }

      const result: TextToImageResult = await inferResponse(message)
      setResult(result)

      // Update previous metrics before setting new metrics
      setPreviousMetrics(metrics)
      setMetrics({
        generation_time_s: result.generation_time_s || 0,
        throughput_s: calculateThroughput(
          imageSize,
          result.generation_time_s || 0,
        ),
      })
    } catch (error) {
      toast.error('Failed to generate image.')
      console.error('Failed to generate image:', error)
    }
  }

  // Handle image download
  const handleDownload = () => {
    if (!result) {
      toast.error('No image to download.')
      return
    }

    try {
      const dataUrl = `data:image/png;base64,${result.image}`

      // Validate base64 string
      const base64String = dataUrl.split(',')[1]
      if (!base64String) {
        throw new Error('Invalid image data.')
      }

      // Decode the base64 string into binary data
      const byteString = window.atob(base64String)
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const uint8Array = new Uint8Array(arrayBuffer)

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }

      // Create a Blob from the binary data
      const blob = new Blob([uint8Array], { type: 'image/png' })
      const blobUrl = URL.createObjectURL(blob)

      // Create a download link using the Blob URL
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `generated-image-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up by revoking the Blob URL
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      toast.error('Failed to download image.')
      console.error('Download error:', error)
    }
  }

  return (
    <div className="space-y-6">
      {metrics ? (
        <PerformanceMetrics
          metrics={[
            {
              name: 'Generation Time',
              value: metrics.generation_time_s
                ? metrics.generation_time_s.toFixed(2)
                : '0.00',
              unit: 's',
              trend: previousMetrics?.generation_time_s
                ? metrics.generation_time_s < previousMetrics.generation_time_s
                  ? 'up'
                  : 'down'
                : undefined,
              trendValue: previousMetrics?.generation_time_s
                ? `${(
                    ((previousMetrics.generation_time_s -
                      metrics.generation_time_s) /
                      previousMetrics.generation_time_s) *
                    100
                  ).toFixed(1)}%`
                : undefined,
              description: previousMetrics?.generation_time_s
                ? metrics.generation_time_s < previousMetrics.generation_time_s
                  ? 'Faster than previous'
                  : 'Slower than previous'
                : undefined,
              context: 'Based on last generation',
            },
            {
              name: 'Throughput',
              value: metrics.throughput_s
                ? metrics.throughput_s.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                : '0',
              unit: 'pixels/s',
              trend: previousMetrics?.throughput_s
                ? metrics.throughput_s > previousMetrics.throughput_s
                  ? 'up'
                  : 'down'
                : undefined,
              trendValue: previousMetrics?.throughput_s
                ? `${(
                    ((metrics.throughput_s - previousMetrics.throughput_s) /
                      previousMetrics.throughput_s) *
                    100
                  ).toFixed(1)}%`
                : undefined,
              description: previousMetrics?.throughput_s
                ? metrics.throughput_s > previousMetrics.throughput_s
                  ? 'Higher than previous'
                  : 'Lower than previous'
                : undefined,
              context: 'Based on model capability',
            },
          ]}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="lg:col-span-3">
          <Card
            className={cn(
              'overflow-hidden py-0',
              workload.status === 'inactive' &&
                'pointer-events-none opacity-60 select-none',
            )}
            aria-disabled={workload.status === 'inactive'}
          >
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Left column - Image prompt inputs */}
              <div className="space-y-6 p-6">
                <div>
                  <h3 className="text-lg font-semibold">Image Generation</h3>
                  <p className="text-muted-foreground text-sm">
                    Enter a prompt to generate an image
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Enter a description of the image you want to generate..."
                      value={textPrompt}
                      onChange={(e) => {
                        // Allow only letters, numbers, spaces, commas, periods, and basic punctuation, max 300 chars
                        const sanitized = e.target.value
                          .replace(/[^a-zA-Z0-9\s.,\-!?]/g, '')
                          .slice(0, 300)
                        setTextPrompt(sanitized)
                      }}
                      className="min-h-[120px] resize-none"
                      maxLength={300}
                    />
                    <p className="text-muted-foreground text-xs">
                      Only letters, numbers, spaces, and basic punctuation
                      allowed. Max 300 characters.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inference-steps">
                      Inference Steps: {inferenceSteps}
                    </Label>
                    <Slider
                      id="inference-steps"
                      min={10}
                      max={50}
                      step={1}
                      value={[inferenceSteps]}
                      onValueChange={(value) => setInferenceSteps(value[0])}
                    />
                    <p className="text-muted-foreground text-xs">
                      Higher values = better quality, slower generation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image-size">Image Size</Label>
                    <Select value={imageSize} onValueChange={setImageSize}>
                      <SelectTrigger id="image-size">
                        <SelectValue placeholder="Select image size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="256x256">256 x 256</SelectItem>
                        <SelectItem value="512x512">512 x 512</SelectItem>
                        <SelectItem value="768x768">768 x 768</SelectItem>
                        <SelectItem value="1024x1024">1024 x 1024</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Larger sizes require more GPU memory
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isInferencing || !textPrompt.trim()}
                  className="w-full"
                >
                  {isInferencing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Image
                    </>
                  )}
                </Button>
              </div>

              {/* Right column - Generated image */}
              <div className="bg-muted/40 max-w-[512px]justify-center relative flex min-h-[500px] flex-col items-center p-6">
                {result ? (
                  <div className="flex w-full flex-col items-center">
                    <div className="relative aspect-square w-full max-w-[480px] overflow-hidden rounded-md shadow-lg">
                      {
                        <Image
                          src={`data:image/png;base64, ${result.image}`}
                          alt="Generated image"
                          className="h-full w-full object-cover"
                          width={Number(imageSize.split('x')[0])}
                          height={Number(imageSize.split('x')[1])}
                          unoptimized
                        />
                      }
                    </div>
                    <Button
                      variant="secondary"
                      className="mt-4 flex items-center gap-2"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                      Download Image
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center">
                    <ImageIcon
                      strokeWidth={0.8}
                      className="mb-4 h-24 w-24 opacity-20"
                    />
                    <p className="text-lg font-medium">
                      No image generated yet
                    </p>
                    <p className="text-sm">Enter a prompt and click Generate</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <WorkloadProfile workload={workload} />
        </div>
      </div>
    </div>
  )
}
