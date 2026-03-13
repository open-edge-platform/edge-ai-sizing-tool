#!/bin/bash

# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0 

set -euo pipefail 

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Error handling function
handle_error() {
    log_error "An error occurred at line $1. Exiting."
    exit 1
}

# Set trap for error handling
trap 'handle_error $LINENO' ERR

# Check if required commands exist
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Required command '$1' not found."
        return 1
    fi
}

# Check if package is installed
is_package_installed() {
    dpkg -l "$1" &> /dev/null
}

# Install package with error checking
install_package() {
    local package="$1"
    log_info "Installing $package..."
    if apt install -y "$package"; then
        log_success "$package installed successfully."
    else
        log_error "Failed to install $package."
        return 1
    fi
}

# Download file with retry logic
download_with_retry() {
    local url="$1"
    local output="$2"
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Downloading $output (attempt $attempt/$max_attempts)..."
        if wget -O "$output" "$url"; then
            log_success "Downloaded $output successfully."
            return 0
        else
            log_warning "Download attempt $attempt failed."
            ((attempt++))
            if [ $attempt -le $max_attempts ]; then
                sleep 5
            fi
        fi
    done
    
    log_error "Failed to download $output after $max_attempts attempts."
    return 1
}

# Check system requirements
check_system_requirements() {
    log_info "Checking system requirements..."
    
    # Check if running on supported Ubuntu version
    if ! grep -qE "Ubuntu 24" /etc/os-release; then
        log_error "This script only supports Ubuntu 24."
        exit 1
    fi
    
    # Check if script is run with sudo
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root. Please use sudo."
        exit 1
    fi
    
    # Check if SUDO_USER is set
    if [ -z "${SUDO_USER:-}" ]; then
        log_error "SUDO_USER environment variable not set. Please run with sudo."
        exit 1
    fi
    
    log_success "System requirements check passed."
}

# Install Intel XPU Manager
install_intel_xpu_manager() {
    log_info "Installing Intel XPU Manager..."
    local xpu_package="xpumanager_1.3.6_20260206.143628.1004f6cb.u24.04_amd64.deb"
    
    download_with_retry "https://github.com/intel/xpumanager/releases/download/v1.3.6/$xpu_package" "$xpu_package"
    
    if dpkg -i "$xpu_package"; then
        log_success "Intel XPU Manager installed successfully."
    else
        log_error "Failed to install Intel XPU Manager."
        exit 1
    fi
    rm -f "$xpu_package"    
}

# Install Intel DLStreamer
install_intel_dlstreamer() {    
    log_info "Installing Intel DLStreamer..."
    
    # Add Intel GPG keys
    if ! wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | tee /usr/share/keyrings/intel-gpg-archive-keyring.gpg > /dev/null; then
        log_error "Failed to add Intel GPG key."
        exit 1
    fi
    
    if ! wget -O- https://apt.repos.intel.com/edgeai/dlstreamer/GPG-PUB-KEY-INTEL-DLS.gpg | tee /usr/share/keyrings/dls-archive-keyring.gpg > /dev/null; then
        log_error "Failed to add Intel DLS GPG key."
        exit 1
    fi
    
    # Add repositories
    echo "deb [signed-by=/usr/share/keyrings/dls-archive-keyring.gpg] https://apt.repos.intel.com/edgeai/dlstreamer/ubuntu24 ubuntu24 main" | tee /etc/apt/sources.list.d/intel-dlstreamer.list
    
    echo "deb [signed-by=/usr/share/keyrings/intel-gpg-archive-keyring.gpg] https://apt.repos.intel.com/openvino/2025 ubuntu24 main" | tee /etc/apt/sources.list.d/intel-openvino-2025.list
    
    apt update
    install_package "intel-dlstreamer=2025.2.0"
    install_package "gstreamer1.0-plugins-ugly"

    log_success "Intel DLStreamer installed successfully."
}

# Install Intel Performance Counter Monitor (Intel PCM)
install_intel_pcm() {
    log_info "Installing Intel® Performance Counter Monitor (Intel® PCM)..."
    
    # Get project root directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Check if pcm directory already exists and remove it
    if [ -d "./pcm/" ]; then
        rm -rf ./pcm/
    fi

    # Git clone and build Intel PCM
    git clone --recursive https://github.com/intel/pcm
    cd pcm || { echo "Failed to change directory to pcm"; exit 1; }
    mkdir -p build
    cd build || { echo "Failed to change directory to build"; exit 1; }
    cmake ..
    cmake --build . --parallel

    # Navigate to project root directory
    cd "$SCRIPT_DIR" || { echo "Failed to change directory to project root"; exit 1; }
}

# Install Node.js version 24
install_nodejs() {
    log_info "Installing Node.js (version 24)..."
    
    # Check if Node.js is already installed with correct version
    if command -v node &> /dev/null; then
        local current_version
        current_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$current_version" = "24" ]; then
            log_success "Node.js version 24 is already installed."
            return 0
        fi
    fi
    
    if curl -fsSL https://deb.nodesource.com/setup_24.x | bash -; then
        log_success "Node.js repository added successfully."
    else
        log_error "Failed to add Node.js repository."
        exit 1
    fi
    
    install_package "nodejs"
    
    # Verify Node.js installation
    log_info "Verifying Node.js installation..."
    if node -v; then
        log_success "Node.js verification successful."
    else
        log_error "Node.js verification failed."
        exit 1
    fi
}

install_uv() {
    log_info "Installing uv (Python package installer)..."
    
    # Get the actual user's home directory (not root)
    local user_home
    user_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    local uv_bin="$user_home/.local/bin/uv"
    
    # Check if uv is already installed for the user
    if [ -f "$uv_bin" ]; then
        local current_version
        current_version=$(su - "$SUDO_USER" -c "uv --version" 2>/dev/null || echo "unknown")
        log_success "uv is already installed: $current_version"
        return 0
    fi
    
    # Install uv using the official installer as the actual user
    log_info "Downloading and installing uv for user $SUDO_USER..."
    if su - "$SUDO_USER" -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'; then
        log_success "uv installed successfully to $user_home/.local/bin/"
    else
        log_error "Failed to install uv."
        exit 1
    fi
    
    # Add uv to PATH for current session
    export PATH="$user_home/.local/bin:$PATH"
    
    # Ensure ~/.local/bin is in user's PATH permanently
    local bashrc="$user_home/.bashrc"
    if [ -f "$bashrc" ]; then
        if ! grep -q '.local/bin' "$bashrc"; then
            log_info "Adding $user_home/.local/bin to PATH in .bashrc..."
            su - "$SUDO_USER" -c "cat >> ~/.bashrc << 'EOF'

# Added by Edge AI Sizing Tool - ensure ~/.local/bin is in PATH
if [ -d '\$HOME/.local/bin' ] && [[ ':\$PATH:' != *':\$HOME/.local/bin:'* ]]; then
    export PATH='\$HOME/.local/bin:\$PATH'
fi
EOF"

            log_success "Added $user_home/.local/bin to PATH in .bashrc"
        else
            log_info "$user_home/.local/bin is already configured in .bashrc"
        fi
    fi
    
    # Create system-wide symlink for easier access
    if [ ! -L "/usr/local/bin/uv" ]; then
        log_info "Creating system-wide symlink to uv..."
        if ln -sf "$uv_bin" /usr/local/bin/uv; then
            log_success "Created symlink: /usr/local/bin/uv -> $uv_bin"
        else
            log_warning "Failed to create system-wide symlink (non-critical)"
        fi
    fi
    
    # Verify uv installation
    log_info "Verifying uv installation..."
    if [ -f "$uv_bin" ] && su - "$SUDO_USER" -c "uv --version" &> /dev/null; then
        local uv_version
        uv_version=$(su - "$SUDO_USER" -c "uv --version")
        log_success "uv verification successful: $uv_version"
        log_info "uv installed to: $uv_bin"
    else
        log_error "uv verification failed."
        log_warning "You may need to restart your shell or run: source ~/.bashrc"
        exit 1
    fi
    
    # Add helpful note
    log_info "Note: uv has been installed to $SUDO_USER's home directory"
    log_info "Path: $user_home/.local/bin/uv"
    log_info "System-wide symlink: /usr/local/bin/uv"
}

# Configure system settings
configure_system() {
    log_info "Configuring system settings..."
    
    # Enable perf_events for non-root users
    log_info "Enabling perf_events for non-root users..."
    if ! grep -q "kernel.perf_event_paranoid=0" /etc/sysctl.conf; then
        echo "kernel.perf_event_paranoid=0" >> /etc/sysctl.conf
        log_success "Added kernel.perf_event_paranoid=0 to /etc/sysctl.conf"
    else
        log_info "kernel.perf_event_paranoid=0 is already set in /etc/sysctl.conf"
    fi
    
    # Apply the changes
    log_info "Applying sysctl changes..."
    if sysctl -p; then
        log_success "Sysctl changes applied successfully."
    else
        log_error "Failed to apply sysctl changes."
        exit 1
    fi
}

# Install MediaMTX
install_mediamtx() {
    log_info "Installing MediaMTX..."
    
    if [ -f "./scripts/setup_mediamtx.sh" ]; then
        if chmod +x "./scripts/setup_mediamtx.sh" && ./scripts/setup_mediamtx.sh; then
            log_success "MediaMTX installed successfully."
        else
            log_error "Failed to install MediaMTX."
            exit 1
        fi
    else
        log_warning "MediaMTX setup script not found at ./scripts/setup_mediamtx.sh"
    fi
}

# Configure user groups
configure_user_groups() {
    log_info "Configuring user groups..."
    
    if ! groups "$SUDO_USER" | grep -qw "video"; then 
        if usermod -aG video "$SUDO_USER"; then
            log_success "Added $SUDO_USER to video group"
            echo "=============================================================="
            echo "IMPORTANT: To apply video group changes, you must:"
            echo "  - Log out and log back in, OR"
            echo "  - Run: newgrp video"
            echo "=============================================================="
        else
            log_error "Failed to add $SUDO_USER to video group."
            exit 1
        fi
    else
        log_info "$SUDO_USER is already in the video group."
    fi
}

# Main installation function
main() {
    log_info "Starting Edge AI Sizing Tool installation..."
    
    # Check system requirements first
    check_system_requirements
    
    # Update package list
    log_info "Updating package list..."
    if apt update; then
        log_success "Package list updated successfully."
    else
        log_error "Failed to update package list."
        exit 1
    fi
    
    # Add Intel graphics repository
    log_info "Adding Intel graphics repository..."
    if add-apt-repository -y ppa:kobuk-team/intel-graphics; then
        log_success "Intel graphics repository added successfully."
    else
        log_error "Failed to add Intel graphics repository."
        exit 1
    fi
    
    # Install necessary packages
    log_info "Installing necessary packages..."
    local packages=(
        "curl"
        "python3-venv"
        "v4l-utils"
        "libze-intel-gpu1"
        "libze1"
        "intel-gsc"
        "wget"
        "gpg"
        "git"
        "cmake"
        "build-essential"
    )
    
    for package in "${packages[@]}"; do
        install_package "$package"
    done
    
    # Install Intel XPU Manager
    install_intel_xpu_manager
    
    # Install Intel DLStreamer and additional plugins
    install_intel_dlstreamer

    # Install Intel PCM
    install_intel_pcm
    
    # Install Node.js
    install_nodejs
    
    # Install uv
    install_uv
    
    # Configure system settings
    configure_system
    
    # Install MediaMTX
    install_mediamtx
    
    # Configure user groups
    configure_user_groups
    
    log_success "Installation and configuration completed successfully!"
}

# Run main function
main "$@"