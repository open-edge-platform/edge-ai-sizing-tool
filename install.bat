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
    setlocal enabledelayedexpansion
    echo winget is not installed. Installing winget...
    
    REM Download and install dependencies first
    echo Downloading winget dependencies package...
    set "DEPENDENCIES_URL=https://github.com/microsoft/winget-cli/releases/latest/download/DesktopAppInstaller_Dependencies.zip"
    set "DEPENDENCIES_ZIP=%TEMP%\DesktopAppInstaller_Dependencies.zip"
    set "DEPENDENCIES_DIR=%TEMP%\DesktopAppInstaller_Dependencies"
    
    REM Clean up any existing dependencies folder
    if exist "!DEPENDENCIES_DIR!" (
        rmdir /s /q "!DEPENDENCIES_DIR!" 2>nul
    )
    mkdir "!DEPENDENCIES_DIR!"
    
    echo Downloading dependencies package...
    powershell -Command "Invoke-WebRequest -Uri '!DEPENDENCIES_URL!' -OutFile '!DEPENDENCIES_ZIP!' -UseBasicParsing -ErrorAction Stop"
    if !errorlevel! neq 0 (
        echo Failed to download dependencies package.
        echo Press any key to exit...
        pause >nul
        exit /b
    )
    
    echo Extracting dependencies package...
    powershell -Command "Expand-Archive -Path '!DEPENDENCIES_ZIP!' -DestinationPath '!DEPENDENCIES_DIR!' -Force"
    if !errorlevel! neq 0 (
        echo Failed to extract dependencies package.
        del "!DEPENDENCIES_ZIP!" 2>nul
        echo Press any key to exit...
        pause >nul
        exit /b
    )
    
    REM Delete the zip file after extraction
    del "!DEPENDENCIES_ZIP!" 2>nul
    
    echo Installing VCLibs UWPDesktop dependency...
    powershell -Command "Add-AppxPackage -Path '!DEPENDENCIES_DIR!\x64\Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_x64.appx'"
    if !errorlevel! neq 0 (
        echo Warning: Failed to install VCLibs UWPDesktop dependency. Continuing anyway...
    )
    
    REM Download and install App Installer (winget) from Microsoft
    echo Downloading App Installer package...
    set "WINGET_URL=https://github.com/microsoft/winget-cli/releases/latest/download/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
    set "WINGET_INSTALLER=%TEMP%\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
    
    powershell -Command "Invoke-WebRequest -Uri '!WINGET_URL!' -OutFile '!WINGET_INSTALLER!' -UseBasicParsing -ErrorAction Stop"
    if !errorlevel! neq 0 (
        echo Failed to download App Installer.
        echo Please manually install "App Installer" from the Microsoft Store or from GitHub - Microsoft/winget-cli
        rmdir /s /q "!DEPENDENCIES_DIR!" 2>nul
        echo Press any key to exit...
        pause >nul
        exit /b
    )
    
    echo Installing App Installer...
    powershell -Command "Add-AppxPackage -Path '!WINGET_INSTALLER!'"
    if !errorlevel! neq 0 (
        echo Failed to install App Installer.
        echo Please manually install "App Installer" from the Microsoft Store or from GitHub - Microsoft/winget-cli
        del "!WINGET_INSTALLER!" 2>nul
        rmdir /s /q "!DEPENDENCIES_DIR!" 2>nul
        echo Press any key to exit...
        pause >nul
        exit /b
    )
    
    REM Clean up installers and temp directories
    del "!WINGET_INSTALLER!" 2>nul
    rmdir /s /q "!DEPENDENCIES_DIR!" 2>nul

    REM Add winget to PATH if not already present
    set "WINGET_PATH=%LOCALAPPDATA%\Microsoft\WindowsApps"
    echo %PATH% | find /i "%WINGET_PATH%" >nul
    if %errorlevel% neq 0 (
        echo Adding winget to PATH...
        setx PATH "%PATH%;%WINGET_PATH%"
        set "PATH=%PATH%;%WINGET_PATH%"
        echo Winget path added to environment variable.
    )
    
    echo App Installer installed successfully.
    echo Verifying winget installation...
    where winget >nul 2>&1
    if !errorlevel! neq 0 (
        echo WARNING: winget still not found in PATH. You may need to restart your terminal.
        echo Press any key to exit...
        pause >nul
        exit /b
    )
    endlocal
)

REM Update Winget to latest version
echo Updating winget to the latest version...
winget update winget --accept-source-agreements --accept-package-agreements && (
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

REM Check if Git is already installed in thirdparty
echo Checking if Git is installed in thirdparty...
if exist "%THIRDPARTY%\git\cmd\git.exe" (
    echo Git is already installed in thirdparty.
    "%THIRDPARTY%\git\cmd\git.exe" --version
) else (
    setlocal enabledelayedexpansion
    echo Installing Git to thirdparty...

    REM Set Git download URL
    set "GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.2/MinGit-2.51.0.2-64-bit.zip"
    set "TEMP_ZIP=%TEMP%\git.zip"
    set "GIT_DIR=%THIRDPARTY%\git"

    REM Clean up any existing partial installations
    if exist "!GIT_DIR!" (
        echo Removing previous Git installation...
        rmdir /s /q "!GIT_DIR!" 2>nul
    )

    REM Create git directory
    mkdir "!GIT_DIR!"

    echo Downloading MinGit from GitHub...
    powershell -Command "Invoke-WebRequest -Uri '!GIT_URL!' -OutFile '!TEMP_ZIP!' -UseBasicParsing -ErrorAction Stop"
    if !errorlevel! neq 0 (
        echo Failed to download Git. Check your internet connection.
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )

    echo Download complete. Extracting to thirdparty...
    tar -xf "!TEMP_ZIP!" -C "!GIT_DIR!"
    if !errorlevel! neq 0 (
        echo Failed to extract Git archive.
        echo Press any key to exit...
        del "!TEMP_ZIP!" 2>nul
        pause >nul
        endlocal
        exit /b
    )

    REM Clean up temp file
    del "!TEMP_ZIP!"

    REM Verify Git installation
    if exist "!GIT_DIR!\cmd\git.exe" (
        echo Git installed successfully in thirdparty.
        "!GIT_DIR!\cmd\git.exe" --version
    ) else (
        echo ERROR: git.exe not found after extraction.
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )
    endlocal
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

REM Check if uv is already installed in thirdparty
echo Checking if uv is installed in thirdparty...
if exist "%THIRDPARTY%\uv\uv.exe" (
    echo uv is already installed in thirdparty.
    "%THIRDPARTY%\uv\uv.exe" --version
) else (
    setlocal enabledelayedexpansion
    echo Installing uv to thirdparty...

    REM Set uv download URL
    set "UV_URL=https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
    set "TEMP_ZIP=%TEMP%\uv.zip"
    set "UV_DIR=%THIRDPARTY%\uv"

    REM Clean up any existing partial installations
    if exist "!UV_DIR!" (
        echo Removing previous uv installation...
        rmdir /s /q "!UV_DIR!" 2>nul
    )

    REM Create uv directory
    mkdir "!UV_DIR!"

    echo Downloading uv from GitHub...
    powershell -Command "Invoke-WebRequest -Uri '!UV_URL!' -OutFile '!TEMP_ZIP!' -UseBasicParsing -ErrorAction Stop"
    if !errorlevel! neq 0 (
        echo Failed to download uv. Check your internet connection.
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )

    echo Download complete. Extracting to thirdparty...
    tar -xf "!TEMP_ZIP!" -C "!UV_DIR!"
    if !errorlevel! neq 0 (
        echo Failed to extract uv archive.
        echo Press any key to exit...
        del "!TEMP_ZIP!" 2>nul
        pause >nul
        endlocal
        exit /b
    )

    REM Clean up temp file
    del "!TEMP_ZIP!"

    REM Verify uv installation
    if exist "!UV_DIR!\uv.exe" (
        echo uv installed successfully in thirdparty.
        "!UV_DIR!\uv.exe" --version
    ) else (
        echo ERROR: uv.exe not found after extraction.
        echo Press any key to exit...
        pause >nul
        endlocal
        exit /b
    )
    endlocal
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
