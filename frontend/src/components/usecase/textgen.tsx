// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Trash2, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Workload } from '@/payload-types'
import { useInfer } from '@/hooks/use-infer'
import { WorkloadProfile } from '@/components/workload-profile'
import { PerformanceMetrics } from '@/components/performance-metrics'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface TextGenerationMessage {
  port: number
  prompt: string
  max_tokens: number
}

interface TextGenerationResult {
  generation_time_s: number
  load_time_s: number
  text: string
  throughput_s: number
  time_to_token_s: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface TextGenProps {
  workload: Workload
}

export function TextGen({ workload }: TextGenProps) {
  const { inferResponse, isInferencing } = useInfer()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [maxTokens, setMaxTokens] = useState(100)
  const [result, setResult] = useState<TextGenerationResult | null>(null)
  const [metrics, setMetrics] = useState<{
    generation_time_s: number
    load_time_s: number
    time_to_token_s: number
    throughput_s: number
  } | null>(
    result
      ? {
          generation_time_s: result.generation_time_s || 0,
          load_time_s: result.load_time_s || 0,
          time_to_token_s: result.time_to_token_s || 0,
          throughput_s: result.throughput_s || 0,
        }
      : {
          generation_time_s: 0,
          load_time_s: 0,
          time_to_token_s: 0,
          throughput_s: 0,
        },
  )
  const [previousMetrics, setPreviousMetrics] = useState<{
    generation_time_s: number
    load_time_s: number
    time_to_token_s: number
    throughput_s: number
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    try {
      if (!inputValue.trim()) return

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: inputValue,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setInputValue('')

      // Send request for infer
      const message: TextGenerationMessage = {
        port: workload?.port as number,
        prompt: inputValue,
        max_tokens: maxTokens,
      }
      const result: TextGenerationResult = await inferResponse(message)

      // Add response message
      const aiResponse: Message = {
        role: 'assistant',
        content: result.text,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiResponse])

      setResult(result)
      // Update previous metrics before setting new metrics
      setPreviousMetrics(metrics)
      setMetrics({
        generation_time_s: result.generation_time_s || 0,
        load_time_s: result.load_time_s || 0,
        time_to_token_s: result.time_to_token_s || 0,
        throughput_s: result.throughput_s || 0,
      })
    } catch (error) {
      toast.error('Failed to generate text.')
      console.error('Failed to generate text:', error)
    }
  }

  const handleClearChat = () => {
    setMessages([])
    // Keep metrics visible after clearing chat
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {metrics ? (
        <PerformanceMetrics
          metrics={[
            {
              name: 'Load Time',
              value: metrics.load_time_s
                ? metrics.load_time_s.toFixed(2)
                : '0.00',
              unit: 's',
              trend: previousMetrics?.load_time_s
                ? metrics.load_time_s < previousMetrics.load_time_s
                  ? 'up'
                  : 'down'
                : undefined,
              trendValue: previousMetrics?.load_time_s
                ? `${(
                    ((previousMetrics.load_time_s - metrics.load_time_s) /
                      previousMetrics.load_time_s) *
                    100
                  ).toFixed(1)}%`
                : undefined,
              description: previousMetrics?.load_time_s
                ? metrics.load_time_s < previousMetrics.load_time_s
                  ? 'Faster than previous'
                  : 'Slower than previous'
                : undefined,
              context: 'Based on last generation',
            },
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
              name: 'Time to First Token',
              value: metrics.time_to_token_s
                ? metrics.time_to_token_s.toFixed(2)
                : '0.00',
              unit: 's',
              trend: previousMetrics?.time_to_token_s
                ? metrics.time_to_token_s < previousMetrics.time_to_token_s
                  ? 'up'
                  : 'down'
                : undefined,
              trendValue: previousMetrics?.time_to_token_s
                ? `${(
                    ((previousMetrics.time_to_token_s -
                      metrics.time_to_token_s) /
                      previousMetrics.time_to_token_s) *
                    100
                  ).toFixed(1)}%`
                : undefined,
              description: previousMetrics?.generation_time_s
                ? metrics.generation_time_s < previousMetrics.generation_time_s
                  ? 'Faster response'
                  : 'Slower response'
                : undefined,
              context: 'Initial response time',
            },
            {
              name: 'Throughput',
              value: metrics.throughput_s
                ? metrics.throughput_s.toFixed(2)
                : '0.00',
              unit: 'tokens/s',
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
              context: 'Text generation speed',
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
              {/* Left column - Settings */}
              <div className="space-y-6 p-6">
                <div>
                  <h3 className="text-lg font-semibold">Text Generation</h3>
                  <p className="text-muted-foreground text-sm">
                    Configure parameters for text generation
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens">Max Tokens: {maxTokens}</Label>
                    <Slider
                      id="max-tokens"
                      min={10}
                      max={2048}
                      step={128}
                      value={[maxTokens]}
                      onValueChange={(value) => setMaxTokens(value[0])}
                    />
                    <p className="text-muted-foreground text-xs">
                      Maximum number of tokens to generate
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column - Chat interface */}
              <div className="bg-muted/20 relative flex h-[500px] flex-col border-l">
                <ScrollArea className="flex-1 p-4">
                  {messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`flex max-w-[80%] gap-2 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {message.role === 'user' ? (
                                <User className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div
                                className={`rounded-lg px-3 py-2 text-sm ${
                                  message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              </div>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center">
                      <MessageSquare
                        strokeWidth={0.8}
                        className="mt-30 mb-4 h-24 w-24 opacity-20"
                      />
                      <p className="text-lg font-medium">No messages yet</p>
                      <p className="text-sm">
                        Start a conversation by sending a message
                      </p>
                    </div>
                  )}
                </ScrollArea>

                {isInferencing && (
                  <div className="text-muted-foreground flex items-center gap-2 px-4 py-2 text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Generating a response...</span>
                  </div>
                )}

                <div className="bg-background flex gap-2 border-t p-4">
                  <Input
                    placeholder="Type your message..."
                    value={inputValue}
                    onChange={(e) => {
                      // Allow only letters, numbers, spaces, commas, periods, and basic punctuation, max 300 chars
                      const sanitized = e.target.value
                        .replace(/[^a-zA-Z0-9\s.,\-!?]/g, '')
                        .slice(0, 300)
                      setInputValue(sanitized)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    maxLength={300}
                    disabled={isInferencing}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isInferencing}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleClearChat}
                    disabled={messages.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground pb-2 pl-4 text-xs">
                  Only letters, numbers, spaces, and basic punctuation allowed.
                  Max 300 characters.
                </p>
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
