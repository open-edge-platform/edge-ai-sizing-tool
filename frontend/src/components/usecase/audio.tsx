// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Mic, Upload, Loader2, Languages, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { useInfer } from '@/hooks/use-infer'
import useAudioRecorder from '@/hooks/use-audio-recorder'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WorkloadProfile } from '@/components/workload-profile'
import { PerformanceMetrics } from '@/components/performance-metrics'
import { cn, formatFileSize } from '@/lib/utils'
import {
  AudioMessage,
  AudioResult,
  AudioProps,
  AudioPerformanceMetrics,
} from '@/types/audio-types'

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

export function Audio({
  workload,
  setPerformanceMetrics,
}: AudioProps & {
  setPerformanceMetrics: React.Dispatch<AudioPerformanceMetrics>
}) {
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
  const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload')

  // Separate state for uploaded and recorded audio to preserve when switching modes
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedAudio, setUploadedAudio] = useState<string | null>(null)
  const [recordedFile, setRecordedFile] = useState<File | null>(null)
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null)

  const { inferResponse, isInferencing } = useInfer()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Audio recorder hook
  const {
    startRecording,
    stopRecording,
    clearRecording,
    visualizerData,
    recording,
    durationSeconds,
    isDeviceFound,
    audioBlob,
    hasSoundRef,
    wasAutomaticallyStoppedRef,
  } = useAudioRecorder()

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
        setUploadedFile(sampleFile)

        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result
          if (typeof dataUrl === 'string') {
            setAudio(dataUrl)
            setUploadedAudio(dataUrl)
          }
        }
        reader.readAsDataURL(sampleFile)
      } catch (error) {
        console.error('Failed to fetch sample audio file:', error)
      }
    }

    fetchSampleAudio()
  }, [])

  // Convert audio blob to WAV format
  const convertToWav = async (blob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext()
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Create WAV file from audio buffer
    const numberOfChannels = audioBuffer.numberOfChannels
    const length = audioBuffer.length * numberOfChannels * 2 + 44
    const buffer = new ArrayBuffer(length)
    const view = new DataView(buffer)
    const channels = []
    let offset = 0
    let pos = 0

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true)
      pos += 2
    }
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true)
      pos += 4
    }

    // "RIFF" chunk descriptor
    setUint32(0x46464952) // "RIFF"
    setUint32(length - 8) // file length - 8
    setUint32(0x45564157) // "WAVE"

    // "fmt " sub-chunk
    setUint32(0x20746d66) // "fmt "
    setUint32(16) // subchunk1size
    setUint16(1) // audio format (1 = PCM)
    setUint16(numberOfChannels)
    setUint32(audioBuffer.sampleRate)
    setUint32(audioBuffer.sampleRate * 2 * numberOfChannels) // byte rate
    setUint16(numberOfChannels * 2) // block align
    setUint16(16) // bits per sample

    // "data" sub-chunk
    setUint32(0x61746164) // "data"
    setUint32(length - pos - 4) // subchunk2size

    // Write interleaved data
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i))
    }

    while (pos < length) {
      for (let i = 0; i < numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(pos, sample, true)
        pos += 2
      }
      offset++
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  // Handle recorded audio blob
  useEffect(() => {
    if (audioBlob && inputMode === 'record') {
      const convertAndSetAudio = async () => {
        try {
          // Convert WebM to WAV for better compatibility with librosa
          const wavBlob = await convertToWav(audioBlob)

          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result
            if (typeof dataUrl === 'string') {
              const recordedFileObj = new File(
                [wavBlob],
                'recorded-audio.wav',
                {
                  type: 'audio/wav',
                },
              )
              setAudio(dataUrl)
              setFile(recordedFileObj)
              // Save to recorded state for mode switching
              setRecordedAudio(dataUrl)
              setRecordedFile(recordedFileObj)
            }
          }
          reader.readAsDataURL(wavBlob)
        } catch (error) {
          console.error('Error converting audio to WAV:', error)
          toast.error('Failed to convert recorded audio. Please try again.')
        }
      }

      convertAndSetAudio()
    }
  }, [audioBlob, inputMode])

  // Handle mode switching - restore appropriate file and audio
  useEffect(() => {
    if (inputMode === 'upload') {
      // Switch to upload mode - restore uploaded file if exists
      if (uploadedFile && uploadedAudio) {
        setFile(uploadedFile)
        setAudio(uploadedAudio)
      }
    } else if (inputMode === 'record') {
      // Switch to record mode - restore recorded file if exists
      if (recordedFile && recordedAudio) {
        setFile(recordedFile)
        setAudio(recordedAudio)
      } else {
        // No recorded audio yet, clear file/audio
        setFile(null)
        setAudio(null)
      }
    }
  }, [inputMode, uploadedFile, uploadedAudio, recordedFile, recordedAudio])

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

    setFile(selectedFile)
    // Save to uploaded state for mode switching
    setUploadedFile(selectedFile)
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (typeof dataUrl === 'string') {
        setAudio(dataUrl)
        setUploadedAudio(dataUrl)
      } else {
        console.error('Error: File could not be read as a Data URL')
      }
    }
    reader.readAsDataURL(selectedFile) // Read as Data URL
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

    // Clear previous result when processing new audio with different settings
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
      const newMetrics = {
        generation_time_s: result.generation_time_s || 0,
      }
      setMetrics(newMetrics)
      setPerformanceMetrics(newMetrics)
    } catch (error) {
      toast.error('Failed to process audio file')
      console.error('Failed to process audio file:', error)
    }
  }

  const handleStartRecording = () => {
    setResult(null)
    // Only clear current display, not the uploaded file state
    setFile(null)
    setAudio(null)
    clearRecording()
    startRecording()
  }

  const handleStopRecording = () => {
    stopRecording(false)
  }

  const handleClearRecording = () => {
    clearRecording()
    setFile(null)
    setAudio(null)
    setResult(null)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
                          Translate to English
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {task === 'transcribe' && (
                    <div className="h-15 space-y-2">
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

                  <div className="space-y-2">
                    <Label>Input Mode</Label>
                    <RadioGroup
                      value={inputMode}
                      onValueChange={(value) =>
                        setInputMode(value as 'upload' | 'record')
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="upload" id="upload" />
                        <Label
                          htmlFor="upload"
                          className="flex cursor-pointer items-center gap-1"
                        >
                          <Upload className="h-4 w-4" />
                          Upload File
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="record" id="record" />
                        <Label
                          htmlFor="record"
                          className="flex cursor-pointer items-center gap-1"
                        >
                          <Mic className="h-4 w-4" />
                          Record Audio
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {inputMode === 'upload' ? (
                    <div
                      className={`hover:bg-muted/50 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-6 text-center ${file ? 'border-primary/40' : 'border-muted-foreground/15'} transition-colors`}
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

                      <Upload
                        strokeWidth={1.2}
                        className="text-muted-foreground mb-4 h-12 w-12"
                      />

                      {file ? (
                        <div className="space-y-3 text-center">
                          <div>
                            <p className="max-w-50 truncate text-sm font-medium">
                              {file.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-muted-foreground mb-1 text-sm">
                            Click to upload or drag and drop your audio file
                            here
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Supports MP3, WAV, M4A, and more (max 50MB)
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!isDeviceFound && (
                        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                          No microphone device found. Please check your
                          microphone connection and permissions.
                        </div>
                      )}

                      <div className="border-muted-foreground/15 flex flex-col items-center rounded-lg border-2 border-dashed p-6">
                        {recording ? (
                          <>
                            <Mic
                              strokeWidth={1.2}
                              className="text-primary mb-4 h-12 w-12 animate-pulse"
                            />
                            <p className="text-primary mb-2 text-sm font-medium">
                              Recording...
                            </p>
                            <div className="mb-4 flex h-16 w-full items-center justify-center gap-0.5">
                              {visualizerData.map((value, index) => (
                                <div
                                  key={index}
                                  className="bg-primary w-1 transition-all duration-75"
                                  style={{
                                    height: `${value * 100}%`,
                                    minHeight: '2px',
                                  }}
                                />
                              ))}
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Duration: {formatDuration(durationSeconds)}
                            </p>
                            {wasAutomaticallyStoppedRef.current && (
                              <p className="text-muted-foreground mt-2 text-xs">
                                Auto-stopped after 2s of silence
                              </p>
                            )}
                          </>
                        ) : audioBlob && hasSoundRef.current ? (
                          <>
                            <Mic
                              strokeWidth={1.2}
                              className="text-muted-foreground mb-4 h-12 w-12"
                            />
                            <p className="mb-1 text-sm font-medium">
                              Recording Complete
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {file?.name || 'recorded-audio.webm'}
                            </p>
                          </>
                        ) : (
                          <>
                            <Mic
                              strokeWidth={1.2}
                              className="text-muted-foreground mb-4 h-12 w-12"
                            />
                            <p className="text-muted-foreground text-sm">
                              Click start to begin recording
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!recording && !audioBlob && (
                          <Button
                            onClick={handleStartRecording}
                            disabled={!isDeviceFound}
                            className="flex-1"
                          >
                            <Mic className="mr-2 h-4 w-4" />
                            Start Recording
                          </Button>
                        )}
                        {recording && (
                          <Button
                            onClick={handleStopRecording}
                            variant="destructive"
                            className="flex-1"
                          >
                            <Mic className="mr-2 h-4 w-4" />
                            Stop Recording
                          </Button>
                        )}
                        {!recording && audioBlob && (
                          <Button
                            onClick={handleClearRecording}
                            variant="outline"
                            className="flex-1"
                          >
                            Clear Recording
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

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
              <div className="bg-muted/40 relative flex h-125 flex-col border-l">
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
