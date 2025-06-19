// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0
import crypto from 'crypto'

export function getRandomInt(min: number, max: number) {
  // Ensure the min and max are integers
  min = Math.ceil(min)
  max = Math.floor(max)
  // Use crypto.getRandomValues for cryptographically secure random numbers
  const range = max - min + 1
  if (range <= 0) throw new Error('Invalid range')
  const randomBuffer = new Uint32Array(1)
  let randomNumber: number
  do {
    crypto.getRandomValues(randomBuffer)
    randomNumber = randomBuffer[0] & 0x7fffffff // Ensure positive integer
  } while (randomNumber >= Math.floor(0x80000000 / range) * range)
  console.log(min + (randomNumber % range))
  return min + (randomNumber % range)
}
