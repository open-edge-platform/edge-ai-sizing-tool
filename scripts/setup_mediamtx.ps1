# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# Variables
$VERSION = "v1.15.6"
$FILENAME = "mediamtx_${VERSION}_windows_amd64.zip"
$DOWNLOAD_URL = "https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/${FILENAME}"
$NSSM_VERSION = "2.24"
$NSSM_FILENAME = "nssm-${NSSM_VERSION}.zip"
$NSSM_DOWNLOAD_URL = "https://nssm.cc/release/${NSSM_FILENAME}"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT = Split-Path -Parent $SCRIPT_DIR
$THIRDPARTY_DIR = Join-Path $REPO_ROOT "thirdparty"
$INSTALL_DIR = Join-Path $THIRDPARTY_DIR "mediamtx"
$NSSM_DIR = Join-Path $INSTALL_DIR "nssm"
$LOG_DIR = Join-Path $INSTALL_DIR "logs"
$LOG_FILE = "$LOG_DIR\mediamtx-setup.log"

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"

    # Ensure log directory exists
    $logDir = Split-Path -Path $LOG_FILE -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    # Write to log file
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
    Write-Log -Message $Message -Level "INFO"
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
    Write-Log -Message $Message -Level "SUCCESS"
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
    Write-Log -Message $Message -Level "WARNING"
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
    Write-Log -Message $Message -Level "ERROR"
}

# Initialize logging
Write-Log -Message "=== MediaMTX Setup Started ===" -Level "INFO"
Write-Log -Message "Version: $VERSION" -Level "INFO"
Write-Log -Message "Repository Root: $REPO_ROOT" -Level "INFO"
Write-Log -Message "Thirdparty Directory: $THIRDPARTY_DIR" -Level "INFO"
Write-Log -Message "Installation Directory: $INSTALL_DIR" -Level "INFO"
Write-Log -Message "Log Directory: $LOG_DIR" -Level "INFO"

# Enable TLS 1.2+ for web requests (required for downloads from GitHub and nssm.cc)
# This enables TLS 1.2 and newer protocols (TLS 1.3 if available)
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# Function to download files with retry logic
function Download-FileWithRetry {
    param(
        [string]$Url,
        [string]$OutFile,
        [int]$MaxRetries = 3,
        [int]$TimeoutSec = 300
    )

    $headers = @{
        'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }

    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            Write-Info "Download attempt $i of ${MaxRetries}: $Url"
            Invoke-WebRequest -Uri $Url -OutFile $OutFile -Headers $headers -UseBasicParsing -TimeoutSec $TimeoutSec
            Write-Success "Download completed successfully."
            return $true
        }
        catch {
            $errorMsg = $_.Exception.Message
            Write-Log -Message "Download attempt $i failed: $errorMsg" -Level "WARNING"

            if ($i -lt $MaxRetries) {
                $waitTime = [Math]::Pow(2, $i) # Exponential backoff: 2s, 4s, 8s
                Write-Warning "Download failed: $errorMsg"
                Write-Info "Retrying in $waitTime seconds..."
                Start-Sleep -Seconds $waitTime
            }
            else {
                Write-Log -Message "All download attempts failed for: $Url" -Level "ERROR"
                throw
            }
        }
    }
    return $false
}

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-ErrorMsg "This script must be run as Administrator. Please restart PowerShell as Administrator."
    exit 1
}

# Check for existing MediaMTX installation and clean up
$existingService = Get-Service -Name "MediaMTX" -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Warning "Existing MediaMTX service found. Cleaning up previous installation..."

    # Stop the service if it's running
    if ($existingService.Status -eq 'Running') {
        Write-Info "Stopping MediaMTX service..."
        try {
            Stop-Service -Name "MediaMTX" -Force -ErrorAction Stop
            Write-Success "MediaMTX service stopped."
        }
        catch {
            Write-Warning "Failed to stop MediaMTX service: $($_.Exception.Message)"
        }
    }

    # Remove the service using NSSM if available, otherwise use sc.exe
    Write-Info "Removing MediaMTX service..."
    $nssmExe = Join-Path $NSSM_DIR "nssm.exe"
    if (Test-Path $nssmExe) {
        try {
            & $nssmExe remove MediaMTX confirm | Out-Null
            Write-Success "MediaMTX service removed (via NSSM)."
        }
        catch {
            Write-Warning "Failed to remove MediaMTX service with NSSM: $($_.Exception.Message)"
            Write-Info "Trying sc.exe..."
            sc.exe delete MediaMTX | Out-Null
        }
    }
    else {
        try {
            sc.exe delete MediaMTX | Out-Null
            Write-Success "MediaMTX service removed."
        }
        catch {
            Write-Warning "Failed to remove MediaMTX service: $($_.Exception.Message)"
        }
    }
}

# Remove existing installation files
if (Test-Path "$INSTALL_DIR\mediamtx.exe") {
    Write-Info "Removing existing MediaMTX installation..."
    try {
        Remove-Item "$INSTALL_DIR\mediamtx.exe" -Force -ErrorAction Stop
        Write-Success "Existing executable removed."
    }
    catch {
        Write-Warning "Failed to remove existing executable: $($_.Exception.Message)"
    }
}

if (Test-Path "$INSTALL_DIR\mediamtx.yml") {
    Write-Info "Removing existing MediaMTX configuration..."
    try {
        Remove-Item "$INSTALL_DIR\mediamtx.yml" -Force -ErrorAction Stop
        Write-Success "Existing configuration removed."
    }
    catch {
        Write-Warning "Failed to remove existing configuration: $($_.Exception.Message)"
    }
}

try {
    # Create directories if they don't exist
    Write-Info "Creating installation directories..."
    if (-not (Test-Path $THIRDPARTY_DIR)) {
        New-Item -ItemType Directory -Path $THIRDPARTY_DIR -Force | Out-Null
    }
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }
    if (-not (Test-Path $NSSM_DIR)) {
        New-Item -ItemType Directory -Path $NSSM_DIR -Force | Out-Null
    }
    if (-not (Test-Path $LOG_DIR)) {
        New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
    }

    # Download MediaMTX
    $tempFile = Join-Path $THIRDPARTY_DIR $FILENAME
    try {
        Download-FileWithRetry -Url $DOWNLOAD_URL -OutFile $tempFile -MaxRetries 3 -TimeoutSec 300
    }
    catch {
        Write-ErrorMsg "Failed to download ${FILENAME} after multiple attempts."
        Write-Log -Message "Download error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Download NSSM (Non-Sucking Service Manager)
    $nssmTempFile = Join-Path $THIRDPARTY_DIR $NSSM_FILENAME
    try {
        Download-FileWithRetry -Url $NSSM_DOWNLOAD_URL -OutFile $nssmTempFile -MaxRetries 3 -TimeoutSec 300
    }
    catch {
        Write-ErrorMsg "Failed to download NSSM after multiple attempts."
        Write-Log -Message "NSSM download error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Extract MediaMTX
    Write-Info "Extracting ${FILENAME}..."
    $tempExtractDir = Join-Path $THIRDPARTY_DIR "mediamtx_extract"
    if (Test-Path $tempExtractDir) {
        Remove-Item $tempExtractDir -Recurse -Force
    }
    try {
        Expand-Archive -Path $tempFile -DestinationPath $tempExtractDir -Force
        Write-Success "MediaMTX extraction completed."
    }
    catch {
        Write-ErrorMsg "Failed to extract ${FILENAME}."
        Write-Log -Message "Extraction error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Extract NSSM
    Write-Info "Extracting NSSM..."
    $nssmTempExtractDir = Join-Path $THIRDPARTY_DIR "nssm_extract"
    if (Test-Path $nssmTempExtractDir) {
        Remove-Item $nssmTempExtractDir -Recurse -Force
    }
    try {
        Expand-Archive -Path $nssmTempFile -DestinationPath $nssmTempExtractDir -Force
        # NSSM extracts to nssm-2.24/win64/nssm.exe or nssm-2.24/win32/nssm.exe
        # Detect architecture and copy the correct version
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        $nssmExtractedPath = Join-Path $nssmTempExtractDir "nssm-${NSSM_VERSION}\$arch\nssm.exe"
        Copy-Item $nssmExtractedPath -Destination $NSSM_DIR -Force
        Write-Success "NSSM extraction completed."
    }
    catch {
        Write-ErrorMsg "Failed to extract NSSM."
        Write-Log -Message "NSSM extraction error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Modify mediamtx.yml to disable RTMP and HLS server
    Write-Info "Modifying mediamtx.yml..."
    $ymlPath = Join-Path $tempExtractDir "mediamtx.yml"
    if (Test-Path $ymlPath) {
        $content = Get-Content $ymlPath -Raw
        $content = $content -replace '(?m)^rtmp:\s+yes$', 'rtmp: no'
        $content = $content -replace '(?m)^hls:\s+yes$', 'hls: no'
        Set-Content -Path $ymlPath -Value $content -NoNewline
        Write-Success "Configuration modified successfully."
    }
    else {
        Write-ErrorMsg "mediamtx.yml not found!"
        exit 1
    }

    # Move files to installation directory
    Write-Info "Installing MediaMTX..."
    Copy-Item "$tempExtractDir\mediamtx.exe" -Destination $INSTALL_DIR -Force
    Copy-Item "$ymlPath" -Destination "$INSTALL_DIR\mediamtx.yml" -Force
    Write-Success "Files installed successfully."

    # Unblock the executables to remove SmartScreen warnings
    Write-Info "Unblocking executables (removing Zone Identifier)..."
    try {
        Unblock-File -Path "$INSTALL_DIR\mediamtx.exe" -ErrorAction Stop
        Write-Success "MediaMTX executable unblocked."
    }
    catch {
        Write-Warning "Failed to unblock mediamtx.exe: $($_.Exception.Message)"
    }
    try {
        Unblock-File -Path "$NSSM_DIR\nssm.exe" -ErrorAction Stop
        Write-Success "NSSM executable unblocked."
    }
    catch {
        Write-Warning "Failed to unblock nssm.exe: $($_.Exception.Message)"
    }

    # Add Windows Defender exclusions
    Write-Info "Adding Windows Defender exclusions..."
    try {
        # Add exclusion for the MediaMTX installation directory
        Add-MpPreference -ExclusionPath $INSTALL_DIR -ErrorAction Stop
        Write-Success "Added directory exclusion: $INSTALL_DIR"

        # Add exclusion for the MediaMTX executable
        Add-MpPreference -ExclusionProcess "mediamtx.exe" -ErrorAction Stop
        Write-Success "Added process exclusion: mediamtx.exe"

        # Add exclusion for NSSM executable
        Add-MpPreference -ExclusionProcess "nssm.exe" -ErrorAction Stop
        Write-Success "Added process exclusion: nssm.exe"

        # Add exclusion for the log directory
        Add-MpPreference -ExclusionPath $LOG_DIR -ErrorAction Stop
        Write-Success "Added directory exclusion: $LOG_DIR"
    }
    catch {
        Write-Warning "Failed to add Windows Defender exclusions: $($_.Exception.Message)"
        Write-Warning "You may need to add exclusions manually if Windows Defender blocks MediaMTX."
    }

    # Create Windows service using NSSM
    Write-Info "Creating Windows service using NSSM..."
    $nssmExe = Join-Path $NSSM_DIR "nssm.exe"
    $mediamtxExe = Join-Path $INSTALL_DIR "mediamtx.exe"
    $mediamtxConfig = Join-Path $INSTALL_DIR "mediamtx.yml"
    $stdoutLog = Join-Path $LOG_DIR "mediamtx-stdout.log"
    $stderrLog = Join-Path $LOG_DIR "mediamtx-stderr.log"

    try {
        # Install the service
        & $nssmExe install MediaMTX $mediamtxExe | Out-Null

        # Set service parameters
        & $nssmExe set MediaMTX AppDirectory $INSTALL_DIR | Out-Null
        & $nssmExe set MediaMTX DisplayName "MediaMTX Media Server" | Out-Null
        & $nssmExe set MediaMTX Description "MediaMTX real-time media server for RTSP, WebRTC, HLS and more" | Out-Null
        & $nssmExe set MediaMTX Start SERVICE_AUTO_START | Out-Null

        # Set up logging
        & $nssmExe set MediaMTX AppStdout $stdoutLog | Out-Null
        & $nssmExe set MediaMTX AppStderr $stderrLog | Out-Null
        & $nssmExe set MediaMTX AppRotateFiles 1 | Out-Null
        & $nssmExe set MediaMTX AppRotateOnline 1 | Out-Null
        & $nssmExe set MediaMTX AppRotateBytes 1048576 | Out-Null

        Write-Success "Windows service created successfully (via NSSM)."
    }
    catch {
        Write-ErrorMsg "Failed to create Windows service with NSSM."
        Write-Log -Message "Service creation error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Start the service
    Write-Info "Starting MediaMTX service..."
    try {
        Start-Service -Name "MediaMTX"
        Write-Success "MediaMTX service started successfully."
    }
    catch {
        Write-ErrorMsg "Failed to start MediaMTX service."
        Write-Log -Message "Service startup error: $($_.Exception.Message)" -Level "ERROR"
        Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
        throw
    }

    # Clean up
    Write-Info "Cleaning up temporary files..."
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    Remove-Item $tempExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $nssmTempFile -Force -ErrorAction SilentlyContinue
    Remove-Item $nssmTempExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cleanup completed."

    Write-Success "`nInstallation completed successfully!"
    Write-Info "MediaMTX executable: $INSTALL_DIR\mediamtx.exe"
    Write-Info "MediaMTX configuration: $INSTALL_DIR\mediamtx.yml"
    Write-Info "NSSM executable: $NSSM_DIR\nssm.exe"
    Write-Info "Service Name: MediaMTX"
    Write-Info "Setup log: $LOG_FILE"
    Write-Info "Service stdout log: $LOG_DIR\mediamtx-stdout.log"
    Write-Info "Service stderr log: $LOG_DIR\mediamtx-stderr.log"
}
catch {
    Write-ErrorMsg "`nInstallation failed: $_"
    Write-Log -Message "Installation failed: $($_.Exception.Message)" -Level "ERROR"
    Write-Log -Message "Stack trace: $($_.ScriptStackTrace)" -Level "ERROR"
    Write-Log -Message "=== MediaMTX Setup Failed ===" -Level "ERROR"

    # Cleanup on error
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempExtractDir) {
        Remove-Item $tempExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $nssmTempFile) {
        Remove-Item $nssmTempFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $nssmTempExtractDir) {
        Remove-Item $nssmTempExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-ErrorMsg "Check the log file for details: $LOG_FILE"
    exit 1
}
