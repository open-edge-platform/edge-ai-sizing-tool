@echo off
setlocal


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