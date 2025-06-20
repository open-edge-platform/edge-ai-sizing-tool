#!/bin/bash

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0 

# Check if the script is run with sudo
if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root. Please use sudo."
  exit 1
fi

# Update package list
echo "Updating package list..."
apt update

# Install necessary packages
echo "Installing necessary packages..."
apt install -y intel-gpu-tools curl python3-venv v4l-utils

# Install Intel® DLStreamer and its dependencies
echo "Installing Intel® DLStreamer and its dependencies..."
# Check Ubuntu version
if grep -q "Ubuntu 22" /etc/os-release; then
  echo "The system is running Ubuntu 22."
  wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | sudo tee /usr/share/keyrings/oneapi-archive-keyring.gpg > /dev/null
  wget -O- https://eci.intel.com/sed-repos/gpg-keys/GPG-PUB-KEY-INTEL-SED.gpg | sudo tee /usr/share/keyrings/sed-archive-keyring.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/sed-archive-keyring.gpg] https://eci.intel.com/sed-repos/$(source /etc/os-release && echo "$VERSION_CODENAME") sed main" | sudo tee /etc/apt/sources.list.d/sed.list
  bash -c 'echo -e "Package: *\nPin: origin eci.intel.com\nPin-Priority: 1000" > /etc/apt/preferences.d/sed'
  bash -c 'echo "deb [signed-by=/usr/share/keyrings/oneapi-archive-keyring.gpg] https://apt.repos.intel.com/openvino/2025 ubuntu22 main" | sudo tee /etc/apt/sources.list.d/intel-openvino-2025.list'
elif grep -q "Ubuntu 24" /etc/os-release; then
  echo "The system is running Ubuntu 24."
  wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | sudo tee /usr/share/keyrings/oneapi-archive-keyring.gpg > /dev/null
  wget -O- https://eci.intel.com/sed-repos/gpg-keys/GPG-PUB-KEY-INTEL-SED.gpg | sudo tee /usr/share/keyrings/sed-archive-keyring.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/sed-archive-keyring.gpg] https://eci.intel.com/sed-repos/$(source /etc/os-release && echo "$VERSION_CODENAME") sed main" | sudo tee /etc/apt/sources.list.d/sed.list
  bash -c 'echo -e "Package: *\nPin: origin eci.intel.com\nPin-Priority: 1000" > /etc/apt/preferences.d/sed'
  bash -c 'echo "deb [signed-by=/usr/share/keyrings/oneapi-archive-keyring.gpg] https://apt.repos.intel.com/openvino/2025 ubuntu24 main" | sudo tee /etc/apt/sources.list.d/intel-openvino-2025.list'  
else
  echo "The system is not Ubuntu 22 or 24."
  echo "Error: The system is not compatible with  Intel® DLStreamer" >&2
  exit 1
fi
# Install  Intel® DLStreamer and additional plugins
apt update
apt-get -y install intel-dlstreamer
apt install -y gstreamer1.0-plugins-ugly

# Install Node.js (version 22)
echo "Installing Node.js (version 22)..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Verify Node.js installation
echo "Verifying Node.js installation..."
node -v

# Enable perf_events for non-root users
echo "Enabling perf_events for non-root users..."

# Add kernel.perf_event_paranoid=0 to /etc/sysctl.conf if not already present
if ! grep -q "kernel.perf_event_paranoid=0" /etc/sysctl.conf; then
    echo "kernel.perf_event_paranoid=0" >> /etc/sysctl.conf
    echo "Added kernel.perf_event_paranoid=0 to /etc/sysctl.conf"
else
    echo "kernel.perf_event_paranoid=0 is already set in /etc/sysctl.conf"
fi

# Apply the changes
echo "Applying sysctl changes..."
sysctl -p

#Install mediamtx
./scripts/setup_mediamtx.sh

echo "Installation and configuration completed!"