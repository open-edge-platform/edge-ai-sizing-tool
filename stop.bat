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