#!/bin/bash

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0 

# Check if the script is run with sudo
if [ "$EUID" -eq 0 ]; then
  echo "This script should NOT be run as root. Please use a regular user."
  exit 1
fi

# Check if pcm-sensor-server exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/pcm/build/bin/pcm-sensor-server" ]; then
  # Set required environment variables
  export PCM_NO_MSR=1
  export PCM_KEEP_NMI_WATCHDOG=1

  # Reset and start Intel PCM sensor server in the background
  if ! sudo "$SCRIPT_DIR/pcm/build/bin/pcm-sensor-server" -r -d &>/dev/null; then
    echo "Error: Failed to start pcm-sensor-server."
    exit 1
  fi
else
  echo "Error: pcm-sensor-server not found."
  echo "Please build Intel PCM first or install it via package manager."
  exit 1
fi

cd frontend && npm run demo