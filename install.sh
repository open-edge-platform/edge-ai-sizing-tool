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
    if ! grep -qE "Ubuntu (22|24)" /etc/os-release; then
        log_error "This script only supports Ubuntu 22 or 24."
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
        "intel-gpu-tools"
        "curl"
        "python3-venv"
        "v4l-utils"
        "libze-intel-gpu1"
        "libze1"
        "intel-gsc"
        "wget"
        "gpg"
    )
    
    for package in "${packages[@]}"; do
        install_package "$package"
    done
    
    # Ubuntu version specific installations
    if grep -q "Ubuntu 22" /etc/os-release; then
        log_info "Detected Ubuntu 22. Installing version-specific packages..."
        install_ubuntu22_packages
    elif grep -q "Ubuntu 24" /etc/os-release; then
        log_info "Detected Ubuntu 24. Installing version-specific packages..."
        install_ubuntu24_packages
    fi
    
    # Install Intel DLStreamer and additional plugins
    log_info "Installing Intel DLStreamer..."
    apt update
    install_package "intel-dlstreamer"
    install_package "gstreamer1.0-plugins-ugly"
    
    # Install Node.js
    install_nodejs
    
    # Configure system settings
    configure_system
    
    # Install MediaMTX
    install_mediamtx
    
    # Configure user groups
    configure_user_groups
    
    log_success "Installation and configuration completed successfully!"
}

install_ubuntu22_packages() {
    # Install Intel XPU Manager
    log_info "Installing Intel XPU Manager for Ubuntu 22..."
    local xpu_package="xpumanager_1.3.1_20250724.061629.60921e5e_u22.04_amd64.deb"
    
    download_with_retry "https://github.com/intel/xpumanager/releases/download/V1.3.1/$xpu_package" "$xpu_package"
    
    if dpkg -i "$xpu_package"; then
        log_success "Intel XPU Manager installed successfully."
    else
        log_error "Failed to install Intel XPU Manager."
        exit 1
    fi
    rm -f "$xpu_package"
    
    setup_intel_repos "ubuntu22"
}

install_ubuntu24_packages() {
    # Install Intel XPU Manager
    log_info "Installing Intel XPU Manager for Ubuntu 24..."
    local xpu_package="xpumanager_1.3.1_20250724.061629.60921e5e_u24.04_amd64.deb"
    
    download_with_retry "https://github.com/intel/xpumanager/releases/download/V1.3.1/$xpu_package" "$xpu_package"
    
    if dpkg -i "$xpu_package"; then
        log_success "Intel XPU Manager installed successfully."
    else
        log_error "Failed to install Intel XPU Manager."
        exit 1
    fi
    rm -f "$xpu_package"
    
    setup_intel_dlstreamer "ubuntu24"
}

setup_intel_dlstreamer() {
    local ubuntu_version="$1"
    
    log_info "Setting up Intel repositories..."
    
    # Add Intel GPG keys
    if ! wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | tee /usr/share/keyrings/oneapi-archive-keyring.gpg > /dev/null; then
        log_error "Failed to add Intel OneAPI GPG key."
        exit 1
    fi
    
    if ! wget -O- https://eci.intel.com/sed-repos/gpg-keys/GPG-PUB-KEY-INTEL-SED.gpg | tee /usr/share/keyrings/sed-archive-keyring.gpg > /dev/null; then
        log_error "Failed to add Intel SED GPG key."
        exit 1
    fi
    
    # Add repositories
    echo "deb [signed-by=/usr/share/keyrings/sed-archive-keyring.gpg] https://eci.intel.com/sed-repos/$(source /etc/os-release && echo "$VERSION_CODENAME") sed main" | tee /etc/apt/sources.list.d/sed.list
    
    echo -e "Package: *\nPin: origin eci.intel.com\nPin-Priority: 1000" > /etc/apt/preferences.d/sed
    
    echo "deb [signed-by=/usr/share/keyrings/oneapi-archive-keyring.gpg] https://apt.repos.intel.com/openvino/2025 $ubuntu_version main" | tee /etc/apt/sources.list.d/intel-openvino-2025.list
    
    log_success "Intel repositories configured successfully."
}

install_nodejs() {
    log_info "Installing Node.js (version 22)..."
    
    # Check if Node.js is already installed with correct version
    if command -v node &> /dev/null; then
        local current_version
        current_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$current_version" = "22" ]; then
            log_success "Node.js version 22 is already installed."
            return 0
        fi
    fi
    
    if curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; then
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

# Run main function
main "$@"