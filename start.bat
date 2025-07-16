@echo off
setlocal

REM Navigate to the frontend directory
cd C:\EAST\frontend
if %errorlevel% neq 0 (
    echo Failed to navigate to the 'frontend' directory. Please check if it exists.
    echo Press any key to exit...
    pause >nul
    exit /b
)

REM Run the demo script using npm
npm run demo && (
    echo 'npm run demo' executed successfully.
    echo Edge AI Sizing Tool started successfully.
) || (
    echo Failed to run 'npm run demo'. Please ensure npm is installed and configured correctly.
    echo Press any key to exit...
    pause >nul
    exit /b
)

endlocal