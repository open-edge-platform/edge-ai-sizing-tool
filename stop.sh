#!/bin/bash

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0 

# Check if the script is run with sudo
if [ "$EUID" -eq 0 ]; then
  echo "This script should NOT be run as root. Please use a regular user."
  exit 1
fi

cd frontend && npm run stop