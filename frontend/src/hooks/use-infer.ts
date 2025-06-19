// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useState } from 'react'
import useSWRMutation from 'swr/mutation'
import { toast } from 'sonner'
import { AudioMessage } from '@/components/usecase/audio'
import { TextToImageMessage } from '@/components/usecase/text2img'
import { TextGenerationMessage } from '@/components/usecase/textgen'

/**
 * Fetcher function for inference response.
 *
 * This function sends a POST request to the specified API endpoint to infer a response.
 * The response can be an image, text, or object based on the request parameters.
 * It handles errors by rejecting the promise with an error message.
 *
 * @param url - The API endpoint URL for response inference.
 * @param arg - An object containing the request parameters for inference.
 * @returns A promise that resolves to the JSON response.
 * @throws An error if the inference fails.
 */

const ALLOWEDENDPOINT = '/api/infer'

async function inferFetcher(
  url: string,
  {
    arg,
  }: {
    arg:
      | Record<string, unknown>
      | AudioMessage
      | TextToImageMessage
      | TextGenerationMessage
  },
) {
  if (url !== ALLOWEDENDPOINT) {
    console.error('Attempted to access unauthorized endpoint')
    return Promise.reject(new Error('Invalid API Endpoint'))
  }

  const response = await fetch(ALLOWEDENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  })
  if (!response.ok) {
    const errorData = await response.json()
    console.log(`errorData: ${JSON.stringify(errorData)}`)
    const errorMessage = errorData.error || 'Error occurred during inference'
    return Promise.reject(new Error(errorMessage))
  }
  return response.json()
}

/**
 * Custom hook for inference response.
 *
 * This hook provides functionality to infer a response from an AI model,
 * which can be an image, text, or object based on the input message.
 *
 * @returns An object containing the inferred response and the isInferencing state.
 */
export function useInfer() {
  const [isInferencing, setIsInferencing] = useState(false)
  const { trigger } = useSWRMutation(ALLOWEDENDPOINT, inferFetcher)

  /**
   * Infer response.
   *
   * This function triggers the inference process using the provided message details.
   * It returns a promise that resolves to the inferred response, which can be an image, text, or object.
   *
   * @param message - The message details used to infer the response.
   * @returns A promise that resolves to the inferred response.
   */
  const inferResponse = async (
    message:
      | Record<string, string | number>
      | AudioMessage
      | TextToImageMessage
      | TextGenerationMessage,
  ) => {
    setIsInferencing(true)

    try {
      const result = await trigger(message)
      toast.success(`Response has been inferred successfully.`)
      return result
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Failed to infer response: ${error.message}`)
      } else {
        toast.error('An unexpected error occurred')
      }
    } finally {
      setIsInferencing(false)
    }
  }

  return { inferResponse, isInferencing }
}
