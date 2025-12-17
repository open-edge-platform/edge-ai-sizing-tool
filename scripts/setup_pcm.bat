@echo off

REM Copyright (C) 2025 Intel Corporation
REM SPDX-License-Identifier: Apache-2.0

setlocal

REM Get the directory of install script (repo root)
set "REPO_ROOT=%1"
REM Get thirdparty directory
set "THIRDPARTY=%2"

REM Install a full driver development environment using a WinGet configuration file
echo Install a full driver development environment...
winget configure -f "%REPO_ROOT%\scripts\configuration.dsc.yaml" --accept-configuration-agreements

REM Check if Intel PCM is already installed in thirdparty
echo Checking if Intel PCM is installed in thirdparty...
if exist "%THIRDPARTY%\pcm\pcm-sensor-server.exe" (
    echo Intel PCM is already installed in thirdparty.
) else (
    setlocal enabledelayedexpansion
    echo Installing Intel PCM to thirdparty...

    set "PCM_DIR=%THIRDPARTY%\pcm"
    set "PCM_REPO=https://github.com/intel/pcm.git"
    
    REM Check if git is available
    where git >nul 2>&1
    if %errorlevel% neq 0 (
        echo Git is not installed. Installing Git...
        winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
        REM Refresh environment variables
        call refreshenv >nul 2>&1
    )

    REM Clone PCM repository
    if not exist "!PCM_DIR!" (
        echo Cloning Intel PCM repository...
        git clone --depth 1 !PCM_REPO! "!PCM_DIR!" && (
            echo PCM repository cloned successfully.
        ) || (
            echo Failed to clone PCM repository.
            echo Press any key to continue...
            pause >nul
            endlocal
            exit /b
        )
    )

    REM Find Visual Studio installation
    set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
    for /f "usebackq tokens=*" %%i in (`"!VSWHERE!" -latest -products * -requires Microsoft.Component.MSBuild -property installationPath`) do (
        set "VS_PATH=%%i"
    )
    
    if not defined VS_PATH (
        echo Visual Studio not found. Please install Visual Studio 2022.
        echo Press any key to continue...
        pause >nul
        cd "%REPO_ROOT%"
        endlocal
        exit /b
    )

    REM Set up Visual Studio environment
    call "!VS_PATH!\Common7\Tools\VsDevCmd.bat" -arch=x64

    REM Build and sign MSR driver
    echo Building MSR driver...
    cd "!PCM_DIR!\src\WinMSRDriver"
    MSBuild.exe MSR.vcxproj -property:Configuration=Release -property:Platform=x64 && (
        echo MSR driver built successfully.
        
        REM Sign the driver (self-signed for testing)
        echo Signing MSR driver...
        cd "!PCM_DIR!\src\WinMSRDriver\x64\Release"
        powershell -ExecutionPolicy Bypass -Command "$cert = New-SelfSignedCertificate -Type CodeSigning -Subject 'CN=PCM-TestCert' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyExportPolicy Exportable; $pwd = ConvertTo-SecureString -String 'PCM-Password-123' -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath TestCert.pfx -Password $pwd; signtool sign /fd SHA256 /f TestCert.pfx /p 'PCM-Password-123' /t http://timestamp.digicert.com MSR.sys; Import-PfxCertificate -FilePath TestCert.pfx -CertStoreLocation 'Cert:\LocalMachine\Root' -Password $pwd"
        
        REM Copy MSR driver
        if exist "!PCM_DIR!\src\WinMSRDriver\x64\Release\MSR.sys" (
            copy "!PCM_DIR!\src\WinMSRDriver\x64\Release\MSR.sys" "!PCM_DIR!\" >nul
            echo MSR.sys copied to !PCM_DIR!
            copy "!PCM_DIR!\src\WinMSRDriver\x64\Release\MSR.sys" "C:\Windows\System32\" >nul
            echo MSR.sys copied to C:\Windows\System32
        )
    ) || (
        echo Failed to build MSR driver. Cannot build PCM sensor server.
        echo Press any key to continue...
        pause >nul
        cd "%REPO_ROOT%"
        endlocal
        exit /b
    )
    
    REM Build PCM using cmake
    echo Building Intel PCM...
    cd "!PCM_DIR!"
    
    REM Configure and build PCM
    cmake -B build && (
        echo CMake configuration successful.
        cmake --build build --config Release --target pcm-sensor-server && (
            echo PCM built successfully.
            
            REM Copy binaries to thirdparty root
            if exist "!PCM_DIR!\build\bin\Release\pcm-sensor-server.exe" (
                copy "!PCM_DIR!\build\bin\Release\pcm-sensor-server.exe" "!PCM_DIR!\" >nul
                echo pcm-sensor-server.exe copied to !PCM_DIR!
            )
        ) || (
            echo Failed to build PCM.
            echo Press any key to continue...
            pause >nul
        )
    ) || (
        echo Failed to configure PCM with CMake.
        echo Press any key to continue...
        pause >nul
    )

    cd "%REPO_ROOT%"
    
    endlocal
)
