@echo off
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
timeout /t 10
endlocal
