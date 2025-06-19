#!/bin/bash

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0 

# Variables
VERSION="v1.11.3"
FILENAME="mediamtx_${VERSION}_linux_amd64.tar.gz"
DOWNLOAD_URL="https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/${FILENAME}"

# Check if mediamtx already exists
if [ -f /usr/local/bin/mediamtx ]; then
  echo "mediamtx is already installed. Exiting."
  exit 0
fi

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root. Please use sudo."
  exit 1
fi

# Install required packages
echo "Installing required packages..."
apt install -y wget tar || { echo "Failed to install required packages."; exit 1; }

# Download the file
echo "Downloading ${FILENAME}..."
if ! wget -q "$DOWNLOAD_URL"; then
  echo "Failed to download ${FILENAME}. Please check the URL."
  exit 1
fi

# Extract the tar.gz file
echo "Extracting ${FILENAME}..."
if ! tar -xzf "$FILENAME"; then
  echo "Failed to extract ${FILENAME}."
  exit 1
fi

# Modify mediamtx.yml to disable RTMP and HLS server
echo "Modifying mediamtx.yml..."
if [ -f mediamtx.yml ]; then
  sed -i 's/^rtmp: yes$/rtmp: no/' mediamtx.yml
  sed -i 's/^hls: yes$/hls: no/' mediamtx.yml
else
  echo "mediamtx.yml not found!"
  exit 1
fi

# Move files to appropriate locations
echo "Moving files..."
if ! mv mediamtx /usr/local/bin/ || ! mv mediamtx.yml /usr/local/etc/; then
  echo "Failed to move files."
  exit 1
fi

# Remove leftover license file
if [ -f LICENSE ]; then
  echo "Removing leftover license file..."
  rm -f LICENSE
fi

# Create systemd service file
echo "Creating systemd service file..."
cat << EOF > /etc/systemd/system/mediamtx.service
[Unit]
Description=MediaMTX Service
Wants=network.target
After=network.target

[Service]
ExecStart=/usr/local/bin/mediamtx /usr/local/etc/mediamtx.yml
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
echo "Setting up systemd service..."
systemctl daemon-reload
systemctl enable mediamtx
systemctl start mediamtx

# Clean up
echo "Cleaning up..."
rm -f "$FILENAME"

echo "Installation completed successfully."