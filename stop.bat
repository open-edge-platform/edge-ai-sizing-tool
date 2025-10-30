REM Copyright (C) 2025 Intel Corporation
REM SPDX-License-Identifier: Apache-2.0

@echo off
setlocal

REM Get the directory of this script (repo root)
set "REPO_ROOT=%~dp0"
REM Remove trailing backslash if present
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

REM Navigate to the frontend directory in the repo
cd /d "%REPO_ROOT%\frontend"
if %errorlevel% neq 0 (
    echo Failed to navigate to the 'frontend' directory. Please check if it exists.
    echo Press any key to exit...
    pause >nul
    exit /b
)

REM Run the stop script using npm
npm run stop && (
    echo 'npm run stop' executed successfully.
    echo Edge AI Sizing Tool stopped successfully.
) || (
    echo Failed to run 'npm run stop'. Please ensure npm is installed and configured correctly.
    echo Press any key to exit...
    pause >nul
    exit /b
)

endlocal
