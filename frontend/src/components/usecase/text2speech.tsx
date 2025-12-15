// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { cn, formatFileSize, sanitizeText } from '@/lib/utils'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Volume2, Download, Loader2, Pause, Play, Trash2 } from 'lucide-react'
import { useInfer } from '@/hooks/use-infer'
import { PerformanceMetrics } from '@/components/performance-metrics'
import { WorkloadProfile } from '@/components/workload-profile'
import {
  TtsMessage,
  TtsResult,
  TtsProps,
  TtsPerformanceMetrics,
} from '@/types/text2speech-types'

export function Text2Speech({
  workload,
  setPerformanceMetrics,
}: TtsProps & {
  setPerformanceMetrics: React.Dispatch<TtsPerformanceMetrics>
}) {
  const [inputText, setInputText] = useState<string>('')
  const [result, setResult] = useState<TtsResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const { inferResponse, isInferencing } = useInfer()
  const [metrics, setMetrics] = useState<{
    generation_time_s: number
  } | null>(
    result
      ? {
          generation_time_s: result.generation_time_s || 0,
        }
      : {
          generation_time_s: 0,
        },
  )
  const [previousMetrics, setPreviousMetrics] = useState<{
    generation_time_s: number
  } | null>(null)

  const handleGenerateSpeech = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter text to convert to speech.')
      return
    }

    setResult(null)

    try {
      const message: TtsMessage = {
        port: workload.port as number,
        text: inputText,
      }

      const result: TtsResult = await inferResponse(message)
      setResult(result)

      setPreviousMetrics(metrics)
      const newMetrics = {
        generation_time_s: result.generation_time_s || 0,
      }
      setMetrics(newMetrics)
      setPerformanceMetrics(newMetrics)
    } catch (error) {
      toast.error('There was an error generating the speech.')
      console.error('Failed to generate speech:', error)
    }
  }

  const handleDownload = () => {
    if (!result) {
      toast.error('No audio available to download.')
      return
    }
    try {
      const audioUrl = `data:audio/wav;base64,${result.audio}`

      const base64String = audioUrl.split(',')[1]
      if (!base64String) {
        throw new Error('Invalid audio data')
      }

      const byteString = window.atob(base64String)
      const uint8Array = new Uint8Array(byteString.length)

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }

      const blob = new Blob([uint8Array], { type: 'audio/wav' })
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `generated-audio-${Date.now()}.wav`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      toast.error('Failed to download audio')
      console.error('Download error:', error)
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const clearAll = () => {
    setInputText('')
    setResult(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  // Calculate the decoded size of base64 audio string
  const getFileSize = (audiofile: string) => {
    const base64 = audiofile.replace(/^data:audio\/\w+;base64,/, '')
    const padding = (base64.match(/=+$/) || [''])[0].length
    const bytes = (base64.length * 3) / 4 - padding
    return formatFileSize(bytes)
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
              {/* Left column - Input Form */}
              <div className="space-y-6 p-6">
                <div>
                  <h3 className="text-lg font-semibold">Speech Generation</h3>
                  <p className="text-muted-foreground text-sm">
                    Enter the text to convert to speech
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="text">Text</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Enter the text that you want to convert to speech..."
                      value={inputText}
                      onChange={(e) => {
                        // Allow only letters, numbers, spaces, commas, periods, and basic punctuation, max 300 chars
                        const sanitized = sanitizeText(e.target.value)
                        setInputText(sanitized)
                      }}
                      className="min-h-[120px] resize-none"
                      maxLength={300}
                    />
                    <p className="text-muted-foreground text-xs">
                      Only letters, numbers, spaces, and basic punctuation
                      allowed. Max 300 characters.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleGenerateSpeech}
                      disabled={isInferencing || !inputText.trim()}
                    >
                      {isInferencing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          Generate Speech
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="icon" onClick={clearAll}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right column - Generated audio */}
              <div className="bg-muted/40 relative flex h-[500px] flex-col border-l">
                <div className="border-b p-4">
                  <h3 className="font-medium">Audio Output</h3>
                </div>
                {result ? (
                  <div className="flex flex-1 flex-col justify-between space-y-4 p-4">
                    <div className="bg-muted/50 space-y-4 rounded-md p-4">
                      <audio
                        src={`data:audio/wav;base64,${result.audio}`}
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        className="hidden"
                        ref={audioRef}
                      >
                        <track kind="captions" label="No captions" />
                      </audio>

                      <div className="flex items-center justify-center space-x-4">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handlePlayPause}
                          className="flex items-center space-x-2 bg-transparent"
                        >
                          {isPlaying ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5" />
                          )}
                          <span>{isPlaying ? 'Pause' : 'Play'}</span>
                        </Button>

                        <Button
                          variant="outline"
                          onClick={handleDownload}
                          className="flex items-center space-x-2 bg-transparent"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </Button>
                      </div>

                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">
                          Format: WAV • Size: {getFileSize(result.audio)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center">
                    <Volume2
                      strokeWidth={0.8}
                      className="mb-4 h-24 w-24 opacity-20"
                    />
                    <p className="text-lg font-medium">
                      No speech generated yet
                    </p>
                    <p className="text-sm">Enter text and click Generate</p>
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
