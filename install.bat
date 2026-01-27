@echo off

REM Copyright (C) 2025 Intel Corporation
REM SPDX-License-Identifier: Apache-2.0

setlocal enabledelayedexpansion

REM Check for administrative privileges
echo Checking for administrative privileges
:checkPrivileges
NET SESSION >nul 2>&1
if %errorlevel% neq 0 (
    echo This script requires administrative privileges. Please run as administrator.
    pause
    exit /b
)

REM Get the directory of this script (repo root)
set "REPO_ROOT=%~dp0"
REM Remove trailing backslash if present
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

REM Set thirdparty directory
set "THIRDPARTY=%REPO_ROOT%\thirdparty"
if not exist "%THIRDPARTY%" mkdir "%THIRDPARTY%"

set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTBAT=%REPO_ROOT%\start.bat"
set "STOPBAT=%REPO_ROOT%\stop.bat"

echo Creating shortcut for start and stop scripts
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\start.lnk'); $s.TargetPath = '%STARTBAT%'; $s.Save()"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\stop.lnk'); $s.TargetPath = '%STOPBAT%'; $s.Save()"

REM Check if winget is installed
echo Checking if winget is installed
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo winget is not installed. Please install "App Installer" from the Microsoft Store or from GitHub - Microsoft/winget-cli and try again.
    echo Press any key to exit...
    pause >nul
    exit /b
)

REM Update Winget to latest version
echo Updating winget to the latest version...
winget update winget && (
    echo winget updated successfully.
) || (
    echo Failed to update winget. Update it manually from Microsoft Store or GitHub - Microsoft/winget-cli.
    echo Continuing with installation...
)
winget --version

REM Check if Python is already installed
echo Checking if Python is installed...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python is already installed.
    python --version
) else (
    echo Installing Python...
    winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements && (
        echo Python installed successfully.
    ) || (
        echo Failed to install Python. Check your internet connection.
        echo Press any key to exit...
        pause >nul
        exit /b
    )
)

REM Setup Intel PCM
call "%REPO_ROOT%\scripts\setup_pcm.bat" "%REPO_ROOT%" "%THIRDPARTY%"

REM Check if Node.js is already installed in thirdparty
echo Checking if Node.js is installed in thirdparty...
if exist "%THIRDPARTY%\nodejs\node.exe" (
    echo Node.js is already installed in thirdparty.
    "%THIRDPARTY%\nodejs\node.exe" --version
) else (
    setlocal enabledelayedexpansion
    echo Installing Node.js to thirdparty...

    REM Determine system architecture
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
        set "NODE_ARCH=x64"
    ) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
        set "NODE_ARCH=arm64"
    ) else (
        echo Unsupported architecture: %PROCESSOR_ARCHITECTURE%
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )

    REM Set Node.js LTS version
    set "NODE_VERSION=24.10.0"
    set "NODE_ZIP=node-v!NODE_VERSION!-win-!NODE_ARCH!.zip"
    set "NODE_URL=https://nodejs.org/dist/v!NODE_VERSION!/!NODE_ZIP!"
    set "TEMP_ZIP=%TEMP%\!NODE_ZIP!"

    echo Downloading Node.js v!NODE_VERSION! for !NODE_ARCH! from nodejs.org...
    powershell -Command "Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!TEMP_ZIP!'" && (
        echo Download complete. Extracting to thirdparty...
        powershell -Command "Expand-Archive -Path '!TEMP_ZIP!' -DestinationPath '%THIRDPARTY%' -Force"

        REM Rename extracted folder to 'nodejs'
        ren "%THIRDPARTY%\node-v!NODE_VERSION!-win-!NODE_ARCH!" nodejs

        REM Clean up temp file
        del "!TEMP_ZIP!"

        echo Node.js installed successfully in thirdparty.
        "%THIRDPARTY%\nodejs\node.exe" --version
    ) || (
        echo Failed to download or extract Node.js. Check your internet connection.
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )
    endlocal
)

REM Check if XPU-SMI is already installed in thirdparty
echo Checking if XPU-SMI is installed in thirdparty...
if not exist "%THIRDPARTY%\xpu-smi\xpu-smi.exe" (
    echo Installing XPU-SMI...
    curl --create-dirs -L -O --output-dir "%THIRDPARTY%\xpu-smi" https://github.com/intel/xpumanager/releases/download/V1.3.1/xpu-smi-1.3.1-20250724.061318.60921e5e_win.zip
    tar -xf "%THIRDPARTY%\xpu-smi\xpu-smi-1.3.1-20250724.061318.60921e5e_win.zip" -C "%THIRDPARTY%\xpu-smi" >nul 2>&1
)

REM Setup DLStreamer (GStreamer + OpenVINO + DLStreamer)
echo.
echo ========================================
echo Setting up DLStreamer
echo ========================================

REM Clean up old DLStreamer environment variables to prevent duplicates
echo Cleaning up old DLStreamer environment paths...
powershell -ExecutionPolicy Bypass -Command "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathEntries = $userPath -split ';' | Where-Object { $_ -and $_ -notmatch 'dlstreamer|DLStreamer|VideoAccelerationCompatibilityPack' }; $cleanPath = $pathEntries -join ';'; [Environment]::SetEnvironmentVariable('Path', $cleanPath, 'User')"
powershell -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('GST_PLUGIN_PATH', $null, 'User')"
powershell -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('LIBVA_DRIVER_NAME', $null, 'User')"
powershell -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('LIBVA_DRIVERS_PATH', $null, 'User')"

set "DLSTREAMER_VERSION=v2025.2.0"
set "DLSTREAMER_PACKAGE_NAME=2025.2"
set "DLSTREAMER_ZIP=%TEMP%\DLStreamer_Windows_%DLSTREAMER_PACKAGE_NAME%.zip"
set "DLSTREAMER_EXTRACT_DIR=%THIRDPARTY%\dlstreamer"
set "DLSTREAMER_ZIP_URL=https://github.com/open-edge-platform/dlstreamer/releases/download/%DLSTREAMER_VERSION%/DLStreamer_Windows_%DLSTREAMER_PACKAGE_NAME%.zip"

echo Downloading DLStreamer package from %DLSTREAMER_ZIP_URL%
powershell -Command "Invoke-WebRequest -Uri '%DLSTREAMER_ZIP_URL%' -OutFile '%DLSTREAMER_ZIP%'"
if !errorlevel! neq 0 (
    echo Failed to download DLStreamer package.
    echo Please check your internet connection.
    echo You can manually download from: %DLSTREAMER_ZIP_URL%
    echo Extract to: %DLSTREAMER_EXTRACT_DIR%
    echo Then run: setup_dls_env.ps1 from the extracted directory
    echo.
    echo Press any key to continue with installation...
    pause >nul
    goto skip_dlstreamer_setup
)

echo DLStreamer package downloaded successfully.
echo Extracting DLStreamer package...

REM Remove existing extraction directory if present
if exist "%DLSTREAMER_EXTRACT_DIR%" (
    echo Removing existing DLStreamer directory...
    rmdir /s /q "%DLSTREAMER_EXTRACT_DIR%"
)

REM Extract the ZIP file
powershell -Command "Expand-Archive -Path '%DLSTREAMER_ZIP%' -DestinationPath '%DLSTREAMER_EXTRACT_DIR%' -Force"

REM Clean up ZIP file
del "%DLSTREAMER_ZIP%"

REM Find and run setup_dls_env.ps1 from extracted directory
REM Search for setup_dls_env.ps1 in any subdirectory
for /f "delims=" %%i in ('dir /s /b "%DLSTREAMER_EXTRACT_DIR%\setup_dls_env.ps1" 2^>nul') do (
    set "SETUP_SCRIPT=%%i"
    goto :found_setup_script
)

echo WARNING: Could not find setup_dls_env.ps1 in extracted package
echo Extracted to: %DLSTREAMER_EXTRACT_DIR%
echo Please verify the package structure.
pause
goto skip_dlstreamer_setup

:found_setup_script
REM Extract the directory containing the setup script
for %%F in ("!SETUP_SCRIPT!") do set "SETUP_DIR=%%~dpF"

REM Clean up old OpenVINO installer from previous downloads
echo Cleaning up old OpenVINO installer cache...
powershell -ExecutionPolicy Bypass -Command "if (Test-Path 'C:\dlstreamer_tmp\openvino_genai_windows_2025.3.0.0_x86_64.zip') { Remove-Item 'C:\dlstreamer_tmp\openvino_genai_windows_2025.3.0.0_x86_64.zip' -Force; Write-Host 'Removed cached OpenVINO installer - will re-download fresh copy' }"

echo Running DLStreamer setup from extracted directory...
echo Setup script found at: !SETUP_SCRIPT!
cd /d "!SETUP_DIR!"
powershell -ExecutionPolicy Bypass -File "setup_dls_env.ps1"
set "DLSTREAMER_EXIT_CODE=!errorlevel!"
cd /d "%REPO_ROOT%"

echo.
echo DLStreamer setup exit code: !DLSTREAMER_EXIT_CODE!

REM Verify GStreamer installation regardless of exit code
REM (setup_dls_env.ps1 may return 0 even when downloads fail)
if not exist "C:\gstreamer\1.0\msvc_x86_64" (
    echo.
    echo ========================================
    echo ERROR: GStreamer installation verification failed
    echo ========================================
    echo.

    if !DLSTREAMER_EXIT_CODE! neq 0 (
        echo DLStreamer setup reported exit code: !DLSTREAMER_EXIT_CODE!
        echo.
    )

    REM Check if GStreamer is installed
    if not exist "C:\gstreamer\1.0\msvc_x86_64" (
        REM GStreamer not installed - check if download failed
        if not exist "C:\dlstreamer_tmp\gstreamer-1.0-msvc-x86_64_1.26.6.msi" (
            echo CAUSE: GStreamer installer download failed (HTTP 418 - anti-bot protection^)
            echo.
            echo ========================================
            echo MANUAL DOWNLOAD AND INSTALLATION REQUIRED
            echo ========================================
            echo.
            echo The GStreamer server blocks automated downloads.
            echo Please manually download and install GStreamer 1.26.6:
            echo.
            echo STEP 1: Download GStreamer installers
            echo -------
            echo Open your browser and download both installers:
            echo.
            echo   a^) Runtime installer:
            echo      https://gstreamer.freedesktop.org/data/pkg/windows/1.26.6/msvc/gstreamer-1.0-msvc-x86_64-1.26.6.msi
            echo.
            echo   b^) Development installer:
            echo      https://gstreamer.freedesktop.org/data/pkg/windows/1.26.6/msvc/gstreamer-1.0-devel-msvc-x86_64-1.26.6.msi
            echo.
            echo STEP 2: Install GStreamer Runtime
            echo -------
            echo   a^) Double-click: gstreamer-1.0-msvc-x86_64-1.26.6.msi
            echo   b^) CRITICAL: Change installation path from "C:\Program Files\gstreamer"
            echo      to "C:\gstreamer" ^(root of C: drive, NO "Program Files"^)
            echo   c^) Select "Complete" installation ^(install all components^)
            echo   d^) Click Install and wait for completion
            echo.
            echo STEP 3: Install GStreamer Development Package
            echo -------
            echo   a^) Double-click: gstreamer-1.0-devel-msvc-x86_64-1.26.6.msi
            echo   b^) CRITICAL: Use the SAME path "C:\gstreamer" ^(it will merge files^)
            echo   c^) Select "Complete" installation
            echo   d^) Click Install and wait for completion
            echo.
            echo STEP 4: Verify Installation
            echo -------
            echo   Confirm these folders exist:
            echo   - C:\gstreamer\1.0\msvc_x86_64\bin
            echo   - C:\gstreamer\1.0\msvc_x86_64\lib
            echo.
            echo   If files are in "C:\Program Files\gstreamer" instead,
            echo   you MUST uninstall and reinstall to C:\gstreamer
            echo.
            echo STEP 5: Rerun Installation
            echo -------
            echo   After GStreamer is installed to C:\gstreamer, rerun this install.bat script
            echo.
            echo ========================================
            echo.
        ) else (
            echo CAUSE: GStreamer installers downloaded but installation failed
            echo.
            echo ========================================
            echo MANUAL INSTALLATION REQUIRED
            echo ========================================
            echo.
            echo The installers are already downloaded but installation failed.
            echo Please install them manually with the correct path:
            echo.
            echo STEP 1: Install GStreamer Runtime
            echo -------
            echo   a^) Double-click: C:\dlstreamer_tmp\gstreamer-1.0-msvc-x86_64_1.26.6.msi
            echo   b^) CRITICAL: Change installation path from "C:\Program Files\gstreamer"
            echo      to "C:\gstreamer" ^(root of C: drive, NO "Program Files"^)
            echo   c^) Select "Complete" installation ^(install all components^)
            echo   d^) Click Install and wait for completion
            echo.
            echo STEP 2: Install GStreamer Development Package
            echo -------
            echo   a^) Double-click: C:\dlstreamer_tmp\gstreamer-1.0-devel-msvc-x86_64_1.26.6.msi
            echo   b^) CRITICAL: Use the SAME path "C:\gstreamer" ^(it will merge files^)
            echo   c^) Select "Complete" installation
            echo   d^) Click Install and wait for completion
            echo.
            echo STEP 3: Verify Installation
            echo -------
            echo   Confirm these folders exist:
            echo   - C:\gstreamer\1.0\msvc_x86_64\bin
            echo   - C:\gstreamer\1.0\msvc_x86_64\lib
            echo.
            echo   If files are in "C:\Program Files\gstreamer" instead,
            echo   you MUST uninstall and reinstall to C:\gstreamer
            echo.
            echo STEP 4: Rerun Installation
            echo -------
            echo   After GStreamer is installed to C:\gstreamer, rerun this install.bat script
            echo.
            echo ========================================
            echo.
        )
    ) else (
        echo GStreamer is installed. Setup failed for another reason.
        echo.
        echo To manually investigate:
        echo   cd "!SETUP_DIR!"
        echo   powershell -ExecutionPolicy Bypass -File "setup_dls_env.ps1"
        echo.
    )

    echo Press any key to exit. After fixing the issue, rerun this install.bat script
    pause >nul
    exit /b
) else (
    echo GStreamer installation verified successfully.
)

REM Final verification message
if !DLSTREAMER_EXIT_CODE! equ 0 (
    if exist "C:\gstreamer\1.0\msvc_x86_64" (
        echo DLStreamer setup completed successfully.
    )
)

:skip_dlstreamer_setup


REM Setup MediaMTX
echo.
echo ========================================
echo Setting up MediaMTX
echo ========================================
if exist "%REPO_ROOT%\scripts\setup_mediamtx.ps1" (
    powershell -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\setup_mediamtx.ps1"
    if !errorlevel! neq 0 (
        echo.
        echo WARNING: MediaMTX setup encountered an error.
        echo This may affect media streaming capabilities.
        echo You can manually run the setup later: scripts\setup_mediamtx.ps1
        echo.
        echo Press any key to continue with installation...
        pause >nul
    ) else (
        echo MediaMTX installed successfully.
    )
) else (
    echo WARNING: MediaMTX setup script not found at scripts\setup_mediamtx.ps1
)

REM Disable path length limit for Python
echo Disabling path length limit...
set "REG_PATH=HKLM\SYSTEM\CurrentControlSet\Control\FileSystem"
set "REG_KEY=LongPathsEnabled"
set "REG_VALUE=1"

REM Check if the registry key exists and set it
reg query "%REG_PATH%" /v "%REG_KEY%" >nul 2>&1
if %errorlevel%==0 (
    reg add "%REG_PATH%" /v "%REG_KEY%" /t REG_DWORD /d %REG_VALUE% /f
    echo Path length limit disabled
) else (
    echo Failed to modify registry. Please check permissions.
    pause
)

echo Installation complete.

REM Enable test signing for the MSR driver
echo Enabling test signing for driver installation...
bcdedit /set testsigning on
echo NOTE: System will need to be rebooted for test signing to take effect.
echo Rebooting system in 10 seconds...

timeout /t 10
shutdown /r /t 0
endlocal
