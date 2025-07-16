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

if not exist "C:\EAST" (
    mkdir "C:\EAST"
    xcopy "%~dp0*" "C:\EAST" /E /I /Y >nul 2>&1
)

cd /d "C:\EAST"

set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTBAT=C:\EAST\start.bat"
set "STOPBAT=C:\EAST\stop.bat"

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

REM Check if Node.js is already installed
echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js is already installed.
    node --version
) else (
    echo Installing Node.js...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements --custom INSTALLDIR="C:\EAST\Tools\NodeJS" && (
        echo Node.js installed successfully.
    ) || (
        echo Failed to install Node.js. Check your internet connection.
        echo Press any key to exit...
        pause >nul
        exit /b
    )
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
