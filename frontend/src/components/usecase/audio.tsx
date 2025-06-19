// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  Upload,
  FileAudio2,
  Loader2,
  Languages,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { Workload } from '@/payload-types'
import { useInfer } from '@/hooks/use-infer'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { WorkloadProfile } from '@/components/workload-profile'
import { PerformanceMetrics } from '@/components/performance-metrics'
import { cn } from '@/lib/utils'

export interface AudioMessage {
  port: number
  file: string
  task: string
  language: string
}

interface AudioResult {
  generation_time_s: number
  text: string
}

interface AudioProps {
  workload: Workload
}

const LANGUAGES = {
  en: 'english',
  zh: 'chinese',
  de: 'german',
  es: 'spanish',
  ru: 'russian',
  ko: 'korean',
  fr: 'french',
  ja: 'japanese',
  pt: 'portuguese',
  tr: 'turkish',
  pl: 'polish',
  ca: 'catalan',
  nl: 'dutch',
  ar: 'arabic',
  sv: 'swedish',
  it: 'italian',
  id: 'indonesian',
  hi: 'hindi',
  fi: 'finnish',
  vi: 'vietnamese',
  he: 'hebrew',
  uk: 'ukrainian',
  el: 'greek',
  ms: 'malay',
  cs: 'czech',
  ro: 'romanian',
  da: 'danish',
  hu: 'hungarian',
  ta: 'tamil',
  no: 'norwegian',
  th: 'thai',
  ur: 'urdu',
  hr: 'croatian',
  bg: 'bulgarian',
  lt: 'lithuanian',
  la: 'latin',
  mi: 'maori',
  ml: 'malayalam',
  cy: 'welsh',
  sk: 'slovak',
  te: 'telugu',
  fa: 'persian',
  lv: 'latvian',
  bn: 'bengali',
  sr: 'serbian',
  az: 'azerbaijani',
  sl: 'slovenian',
  kn: 'kannada',
  et: 'estonian',
  mk: 'macedonian',
  br: 'breton',
  eu: 'basque',
  is: 'icelandic',
  hy: 'armenian',
  ne: 'nepali',
  mn: 'mongolian',
  bs: 'bosnian',
  kk: 'kazakh',
  sq: 'albanian',
  sw: 'swahili',
  gl: 'galician',
  mr: 'marathi',
  pa: 'punjabi',
  si: 'sinhala',
  km: 'khmer',
  sn: 'shona',
  yo: 'yoruba',
  so: 'somali',
  af: 'afrikaans',
  oc: 'occitan',
  ka: 'georgian',
  be: 'belarusian',
  tg: 'tajik',
  sd: 'sindhi',
  gu: 'gujarati',
  am: 'amharic',
  yi: 'yiddish',
  lo: 'lao',
  uz: 'uzbek',
  fo: 'faroese',
  ht: 'haitian creole',
  ps: 'pashto',
  tk: 'turkmen',
  nn: 'nynorsk',
  mt: 'maltese',
  sa: 'sanskrit',
  lb: 'luxembourgish',
  my: 'myanmar',
  bo: 'tibetan',
  tl: 'tagalog',
  mg: 'malagasy',
  as: 'assamese',
  tt: 'tatar',
  haw: 'hawaiian',
  ln: 'lingala',
  ha: 'hausa',
  ba: 'bashkir',
  jw: 'javanese',
  su: 'sundanese',
}

export function Audio({ workload }: AudioProps) {
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe')
  const [language, setLanguage] = useState('en')
  const [result, setResult] = useState<AudioResult | null>(null)
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

  const [file, setFile] = useState<File | null>(null)
  const [audio, setAudio] = useState<string | null>(null)
  const { inferResponse, isInferencing } = useInfer()

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Fetch the sample audio file
    const fetchSampleAudio = async () => {
      try {
        const response = await fetch(
          'https://storage.openvinotoolkit.org/models_contrib/speech/2021.2/librispeech_s5/how_are_you_doing_today.wav',
        )
        const blob = await response.blob()
        const sampleFile = new File([blob], 'how_are_you_doing_today.wav', {
          type: 'audio/wav',
        })

        // Set the file and read it as a Data URL
        setFile(sampleFile)

        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result
          if (typeof dataUrl === 'string') {
            setAudio(dataUrl)
          }
        }
        reader.readAsDataURL(sampleFile)
      } catch (error) {
        console.error('Failed to fetch sample audio file:', error)
      }
    }

    fetchSampleAudio()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        validateAndSetFile(selectedFile)
      }
    } catch (error) {
      console.error('Error handling the audio file:', error)
      toast.error('An error occurred while selecting the file.')
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('audio/')) {
      toast.error(`Please upload an audio file (MP3, WAV, etc.).`)
      return
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error(`Please upload an audio file smaller than 50MB.`)
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (typeof dataUrl === 'string') {
        setAudio(dataUrl)
      } else {
        console.error('Error: File could not be read as a Data URL')
      }
    }

    reader.onerror = (error) => {
      console.error('Error reading the file:', error)
    }

    reader.readAsDataURL(selectedFile) // Read as Data URL

    setFile(selectedFile)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    try {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        validateAndSetFile(e.dataTransfer.files[0])
      }
    } catch (error) {
      console.error('Error during file drop:', error)
      toast.error('An error occurred while dropping the file.')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch (error) {
      console.error('Error during drag over event:', error)
      toast.error('An error occurred while dragging the file.')
    }
  }

  const handleProcess = async () => {
    if (!audio || !file) {
      toast.error('No audio data to process')
      return
    }

    setResult(null)

    try {
      const message: AudioMessage = {
        port: workload?.port as number,
        file: audio,
        task: task,
        language: task === 'translate' ? 'en' : language,
      }
      const result: AudioResult = await inferResponse(message)

      setResult(result)
      // Update previous metrics before setting new metrics
      setPreviousMetrics(metrics)
      setMetrics({
        generation_time_s: result.generation_time_s || 0,
      })
    } catch (error) {
      toast.error('Failed to process audio file')
      console.error('Failed to process audio file:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
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
              {/* Left column - Audio input and settings */}
              <div className="space-y-6 p-6">
                <div>
                  <h3 className="text-lg font-semibold">Speech Recognition</h3>
                  <p className="text-muted-foreground text-sm">
                    Upload an audio file to{' '}
                    {task === 'transcribe' ? 'transcribe' : 'translate'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Task</Label>
                    <RadioGroup
                      value={task}
                      onValueChange={(value) =>
                        setTask(value as 'transcribe' | 'translate')
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="transcribe" id="transcribe" />
                        <Label
                          htmlFor="transcribe"
                          className="flex cursor-pointer items-center"
                        >
                          <FileText className="h-4 w-4" />
                          Transcribe
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="translate" id="translate" />
                        <Label
                          htmlFor="translate"
                          className="flex cursor-pointer items-center"
                        >
                          <Languages className="h-4 w-4" />
                          Translate
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {task === 'transcribe' && (
                    <div className="h-[60px] space-y-2">
                      <Label htmlFor="language">Target Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LANGUAGES).map(([code, name]) => (
                            <SelectItem key={code} value={code}>
                              {name.charAt(0).toUpperCase() + name.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div
                    className={`pt-10border-dashed hover:bg-muted/50 flex cursor-pointer flex-col items-center rounded-lg border-2 p-6 text-center ${file ? 'border-primary/40' : 'border-muted-foreground/15'} transition-colors`}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        fileInputRef.current?.click()
                      }
                    }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="audio/mp3,audio/wav,audio/x-m4a"
                      onChange={handleFileChange}
                    />

                    <FileAudio2
                      strokeWidth={1.2}
                      className="text-muted-foreground mb-4 h-12 w-12"
                    />

                    {file ? (
                      <div className="text-center">
                        <p className="max-w-[200px] truncate text-sm font-medium">
                          {file.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-muted-foreground mb-1 text-sm">
                          Click to upload or drag and drop your audio file here
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Supports MP3, WAV, M4A, and more (max 50MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleProcess}
                    disabled={isInferencing || !file}
                    className="w-full"
                  >
                    {isInferencing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {task === 'transcribe'
                          ? 'Transcribing...'
                          : 'Translating...'}
                      </>
                    ) : (
                      <>
                        {task === 'transcribe' ? (
                          <>
                            <Mic className="h-4 w-4" />
                            Transcribe Audio
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            Translate Audio
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right column - Results */}
              <div className="bg-muted/40 relative flex h-[500px] flex-col border-l">
                <div className="border-b p-4">
                  <h3 className="font-medium">
                    {task === 'transcribe' ? 'Transcription' : 'Translation'}{' '}
                    Result
                  </h3>
                </div>

                {result ? (
                  <ScrollArea className="flex-1 p-4">
                    <div className="whitespace-pre-wrap">{result.text}</div>
                  </ScrollArea>
                ) : (
                  <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center">
                    <Mic
                      strokeWidth={1.2}
                      className="mb-4 h-24 w-24 opacity-20"
                    />
                    <p className="text-lg font-medium">
                      No{' '}
                      {task === 'transcribe' ? 'transcription' : 'translation'}{' '}
                      yet
                    </p>
                    <p className="text-sm">
                      Upload an audio file and click{' '}
                      {task === 'transcribe' ? 'Transcribe' : 'Translate'}
                    </p>
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
