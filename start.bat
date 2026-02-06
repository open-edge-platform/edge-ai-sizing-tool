@echo off

REM Copyright (C) 2025 Intel Corporation
REM SPDX-License-Identifier: Apache-2.0

setlocal

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

REM Prepend thirdparty\nodejs to PATH for portable node/npm/pm2
set "PATH=%REPO_ROOT%\thirdparty\nodejs;%PATH%"

REM Set PM2_HOME to repo-local directory so PM2 state is portable
set "PM2_HOME=%REPO_ROOT%\.pm2"

REM Set explicit paths to npm and pm2 in thirdparty
set "NPM=%REPO_ROOT%\thirdparty\nodejs\npm.cmd"
set "NODE=%REPO_ROOT%\thirdparty\nodejs\node.exe"

REM Set path to PCM sensor server
set "PCM_SERVER=%REPO_ROOT%\thirdparty\pcm\pcm-sensor-server.exe"

REM Check if pcm-sensor-server.exe exists
if not exist "%PCM_SERVER%" (
    echo WARNING: pcm-sensor-server.exe not found at %PCM_SERVER%
    echo Continuing without power monitoring...
    timeout /t 3 /nobreak >nul
    goto :skipPCM
)

REM Start PCM sensor server in background
echo Starting PCM sensor server...
start /B "" "%PCM_SERVER%" -r >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Failed to start pcm-sensor-server.exe
    echo This requires administrator privileges.
    echo Continuing without power monitoring...
    timeout /t 3 /nobreak >nul
) else (
    echo PCM sensor server started successfully.
    REM Wait a moment for server to initialize
    timeout /t 3 /nobreak >nul
)

:skipPCM

REM Set path to MediaMTX NSSM service manager
set "NSSM_EXE=%REPO_ROOT%\thirdparty\mediamtx\nssm\nssm.exe"

REM Start MediaMTX service using NSSM
if exist "%NSSM_EXE%" (
    echo Starting MediaMTX service...
    "%NSSM_EXE%" start MediaMTX
    echo MediaMTX service start command executed.
) else (
    echo WARNING: MediaMTX NSSM not found at %NSSM_EXE%
    echo Continuing without MediaMTX streaming server...
)

REM Navigate to the frontend directory in the repo
cd /d "%REPO_ROOT%\frontend"
if %errorlevel% neq 0 (
    echo Failed to navigate to the 'frontend' directory. Please check if it exists.
    echo Press any key to exit...
    pause >nul
    goto :eof
)

REM Run the demo script using local npm
call "%NPM%" run demo && (
    echo 'npm run demo' executed successfully.
    echo Edge AI Sizing Tool started successfully.
    REM Wait a few seconds to ensure the server is up
    echo Opening browser automatically in 3 seconds...
    timeout /t 3 /nobreak >nul

    start http://localhost:8080
    echo Browser opened.
    echo.
    timeout /t 3 /nobreak >nul


) || (
    echo Failed to run 'npm run demo'. Please ensure npm is installed and configured correctly.
    echo Press any key to exit...
    pause >nul
    goto :eof
)
REM Example: To use pm2, use "%PM2%" <args>

endlocal