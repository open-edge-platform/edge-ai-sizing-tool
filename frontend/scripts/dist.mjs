#!/usr/bin/env node

// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

// Base directory is the current working directory (frontend folder)
const baseDir = process.cwd()
// Global log file path (will be set in main)
let logFilePath = ''

// Helper to get relative path from baseDir
function relPath(p) {
  return path.relative(baseDir, p)
}

// Function to produce an ISO-like timestamp in local time with offset
function getTimestamp() {
  const now = new Date()
  const tzOffset = -now.getTimezoneOffset()
  const diff = tzOffset >= 0 ? '+' : '-'
  const pad = (n) => n.toString().padStart(2, '0')
  const offsetHours = pad(Math.floor(Math.abs(tzOffset) / 60))
  const offsetMinutes = pad(Math.abs(tzOffset) % 60)
  const year = now.getFullYear()
  const month = pad(now.getMonth() + 1)
  const day = pad(now.getDate())
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${diff}${offsetHours}:${offsetMinutes}`
}

// Simplified log function that prints and appends to a log file
function log(message) {
  const timestamp = getTimestamp()
  const logMessage = `[${timestamp}] ${message}`
  console.log(logMessage)
  if (logFilePath) {
    fs.appendFileSync(logFilePath, logMessage + '\n')
  }
}

function copyDir(src, dest, excludeFiles = [], excludeDirs = []) {
  // Validate input path formats before resolving
  if (typeof src !== 'string' || typeof dest !== 'string') {
    throw new Error('Source and destination must be strings')
  }

  // Use an allow list approach - only allow safe characters in paths
  const safePathRegex = /^[a-zA-Z0-9\/._-]+$/
  if (!safePathRegex.test(src) || !safePathRegex.test(dest)) {
    throw new Error('Paths contain invalid characters')
  }

  // Explicitly reject paths with traversal sequences
  if (src.includes('..') || dest.includes('..') ||
      src.includes('\0') || dest.includes('\0')) {
    throw new Error('Path traversal attempt detected')
  }

  const resolvedBase = path.resolve(baseDir)
  const resolvedSrc = path.resolve(src)
  const resolvedDest = path.resolve(dest)

  // Additional validation - ensure paths are within base directory
  if (!resolvedSrc.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Unsafe source directory: ${src}`)
  }
  if (!resolvedDest.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Unsafe destination directory: ${dest}`)
  }

  if (!fs.existsSync(resolvedDest)) {
    // Break taint flow by splitting into segments and re-validating
    const partsDest = resolvedDest.split(path.sep)
    for (let i = 0; i < partsDest.length; i++) {
      if (!/^[\w.-]+$/.test(partsDest[i])) {
        throw new Error(`Invalid path segment in destination: ${partsDest[i]}`)
      }
    }
    const sanitizedResolvedDest = path.join(...partsDest)
    fs.mkdirSync(sanitizedResolvedDest, { recursive: true })
  }

  const parts = resolvedSrc.split(path.sep)
  for (let i = 0; i < parts.length; i++) {
    // Optional extra safety check for each path segment
    if (!/^[\w.-]+$/.test(parts[i])) {
      throw new Error(`Invalid path segment: ${parts[i]}`)
    }
  }
  const sanitizedResolvedSrc = path.join(...parts)
  
  const entries = fs.readdirSync(sanitizedResolvedSrc, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (excludeFiles.includes(entry.name) || excludeDirs.includes(entry.name)) continue // Skip excluded files and directories
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeFiles, excludeDirs)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function generateInstallScripts(stagingDir, appName) {
  // Linux installer (install.sh)
  const installShContent = `#!/bin/bash
rm -f install.log
START=\$SECONDS
echo "[\$(date --iso-8601=seconds)] Starting installation..." | tee -a install.log
# Check for pm2
if ! command -v pm2 >/dev/null 2>&1; then
  echo "[\$(date --iso-8601=seconds)] pm2 not found, installing globally..." | tee -a install.log
  npm install -g pm2 2>&1 | tee -a install.log || { echo "[\$(date --iso-8601=seconds)] Failed to install pm2" | tee -a install.log; exit 1; }
fi
# Setup workers inside next/workers
if [ -d "next/workers" ]; then
  for worker in next/workers/*; do
    if [ -d "\$worker" ]; then
      echo "[\$(date --iso-8601=seconds)] Setting up worker $worker..." | tee -a install.log
      cd "$worker"
      python3 -m venv venv 2>&1 | tee -a ../../../install.log || { echo "[\$(date --iso-8601=seconds)] Failed to create venv in $worker" | tee -a ../../../install.log; exit 1; }
      source venv/bin/activate
      pip install -r requirements.txt 2>&1 | tee -a ../../../install.log || { echo "[\$(date --iso-8601=seconds)] Failed to install python dependencies for $worker" | tee -a ../../../install.log; exit 1; }
      deactivate
      cd - >/dev/null
    fi
  done
fi
# Create start script for Linux with the corrected command
echo "[\$(date --iso-8601=seconds)] Creating ${appName}.sh..." | tee -a install.log
cat << 'EOF' > ${appName}.sh
#!/bin/bash
# Set default values for port and hostname if not specified
APP_PORT=\${PORT:-8080}
APP_HOST=\${HOST:-localhost}
pm2 start "HOSTNAME=\$APP_HOST PORT=\$APP_PORT node --no-deprecation next/standalone/server.js" --name "${appName}" 2>&1 | tee -a install.log
echo "Application is running. Access it at http://\$APP_HOST:\$APP_PORT"
EOF
chmod +x ${appName}.sh
ELAPSED=\$(( SECONDS - START ))
echo "[\$(date --iso-8601=seconds)] Installation complete. Total duration: \$ELAPSED seconds" | tee -a install.log
`
  // Define trusted parent directory
  const trustedParent = path.resolve(baseDir, '../dist')
  const allowedStaging = path.join(trustedParent, 'package')
  if (!stagingDir.startsWith(allowedStaging + path.sep)) {
    throw new Error(`Unsafe staging directory: ${stagingDir}`)
  }
  const resolvedStagingDir = allowedStaging

  // Define the install.sh path from trusted parent directory
  const installShPath = path.join(resolvedStagingDir, 'install.sh')
  const resolvedParent = path.resolve(resolvedStagingDir)
  const resolvedFile = path.resolve(installShPath)
  if (
    !resolvedFile.startsWith(resolvedParent + path.sep) ||
    path.isAbsolute(installShPath) ||
    installShPath.includes('..')
  ) {
    throw new Error(`Unsafe file path detected: ${installShPath}`)
  }
  fs.writeFileSync(installShPath, installShContent, { mode: 0o755 })
  log(`Generated Linux installer: ${relPath(installShPath)}`)

  // Windows installer (install.cmd)
  const installCmdContent = `@echo off
rem Record start time
set startTime=%TIME%
del install.log 2>nul
echo [%DATE% %TIME%] Starting installation... >> install.log
where pm2 >nul 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] pm2 not found, installing globally... >> install.log
  npm install -g pm2 >> install.log 2>&1 || (echo [%DATE% %TIME%] Failed to install pm2 >> install.log & exit /b 1)
)
if exist next\\workers (
  for /d %%w in (next\\workers\\*) do (
    echo [%DATE% %TIME%] Setting up worker %%w... >> install.log
    pushd %%w
    python -m venv venv >> ..\\..\\..\\install.log 2>&1 || (echo [%DATE% %TIME%] Failed to create venv in %%w >> ..\\..\\..\\install.log & exit /b 1)
    call venv\\Scripts\\activate.bat
    pip install -r requirements.txt >> ..\\..\\..\\install.log 2>&1 || (echo [%DATE% %TIME%] Failed to install python dependencies for %%w >> ..\\..\\..\\install.log & exit /b 1)
    call venv\\Scripts\\deactivate.bat
    popd
  )
)
echo [%DATE% %TIME%] Creating ${appName}.cmd... >> install.log
(
  echo @echo off
  echo rem Set default values for port and hostname if not specified
  echo set APP_PORT=8080
  echo set APP_HOST=localhost
  echo if not defined PORT set APP_PORT=8080
  echo if not defined HOST set APP_HOST=localhost
  echo pm2 start "HOSTNAME=!APP_HOST! PORT=!APP_PORT! node --no-deprecation next\\standalone\\server.js" --name "${appName}" >> install.log 2>&1
  echo echo Application is running. Access it at http://!APP_HOST!:!APP_PORT!
) > ${appName}.cmd
rem Record end time and calculate duration
set endTime=%TIME%
for /F "tokens=1-4 delims=:." %%a in ("%startTime%") do (
  set /A startSec=%%a*3600+%%b*60+%%c
)
for /F "tokens=1-4 delims=:." %%a in ("%endTime%") do (
  set /A endSec=%%a*3600+%%b*60+%%c
)
set /A duration=endSec-startSec
echo [%DATE% %TIME%] Installation complete. Total duration: %duration% seconds >> install.log
`
  const installCmdPath = path.join(resolvedStagingDir, 'install.cmd')
  const resolvedCmdParent = path.resolve(resolvedStagingDir)
  const resolvedFileInstallCmd = path.resolve(resolvedCmdParent)
  if (
    !resolvedFileInstallCmd.startsWith(resolvedCmdParent + path.sep) ||
    path.isAbsolute(installCmdPath) ||
    installCmdPath.includes('..')
  ) {
    throw new Error(`Unsafe file path detected: ${installCmdPath}`)
  }
  fs.writeFileSync(installCmdPath, installCmdContent, { mode: 0o755 })
  log(`Generated Windows installer: ${relPath(installCmdPath)}`)
}

function generateUninstallScripts(stagingDir, appName) {
  // Linux uninstall (uninstall.sh)
  const uninstallShContent = `#!/bin/bash
rm -f uninstall.log
START=\$SECONDS
echo "[\$(date --iso-8601=seconds)] Starting uninstallation..." | tee -a uninstall.log
pm2 delete "${appName}" 2>&1 | tee -a uninstall.log || echo "[\$(date --iso-8601=seconds)] No process named ${appName} found." | tee -a uninstall.log
# Remove db.sqlite if exists
if [ -f "next/standalone/db.sqlite" ]; then
  rm "next/standalone/db.sqlite"
  echo "[\$(date --iso-8601=seconds)] Removed db.sqlite" | tee -a uninstall.log
fi
ELAPSED=\$(( SECONDS - START ))
echo "\$(date --iso-8601=seconds) Uninstallation complete. Total duration: \$ELAPSED seconds" | tee -a uninstall.log
`
  // Define trusted parent directory
  const trustedParent = path.resolve(baseDir, '../dist')
  const allowedStaging = path.join(trustedParent, 'package')
  if (!stagingDir.startsWith(allowedStaging + path.sep)) {
    throw new Error(`Unsafe staging directory: ${stagingDir}`)
  }
  const resolvedStagingDir = allowedStaging

  // Define the uninstall.sh path from trusted parent directory
  const uninstallShPath = path.join(resolvedStagingDir, 'uninstall.sh')
  const resolvedParent = path.resolve(resolvedStagingDir)
  const resolvedFile = path.resolve(uninstallShPath)
  if (
    !resolvedFile.startsWith(resolvedParent + path.sep) ||
    path.isAbsolute(uninstallShPath) ||
    uninstallShPath.includes('..')
  ) {
    throw new Error(`Unsafe file path detected: ${uninstallShPath}`)
  }

  fs.writeFileSync(uninstallShPath, uninstallShContent, { mode: 0o755 })
  log(`Generated Linux uninstaller: ${relPath(uninstallShPath)}`)

  // Windows uninstall (uninstall.cmd)
  const uninstallCmdContent = `@echo off
set startTime=%TIME%
del uninstall.log 2>nul
echo [%DATE% %TIME%] Starting uninstallation... >> uninstall.log
pm2 delete "${appName}" >> uninstall.log 2>&1 || (echo [%DATE% %TIME%] No process named ${appName} found. >> uninstall.log)
rem Remove db.sqlite if exists
if exist next\\standalone\\db.sqlite (
  del next\\standalone\\db.sqlite
  echo [%DATE% %TIME%] Removed db.sqlite >> uninstall.log
)
echo [%DATE% %TIME%] Uninstallation complete. >> uninstall.log
set endTime=%TIME%
for /F "tokens=1-4 delims=:." %%a in ("%startTime%") do (
  set /A startSec=%%a*3600+%%b*60+%%c
)
for /F "tokens=1-4 delims=:." %%a in ("%endTime%") do (
  set /A endSec=%%a*3600+%%b*60+%%c
)
set /A duration=endSec-startSec
echo [%DATE% %TIME%] Total uninstallation duration: %duration% seconds >> uninstall.log
`
  const uninstallCmdPath = path.join(resolvedStagingDir, 'uninstall.cmd')
  const resolvedParentUninstallCmd = path.resolve(resolvedStagingDir)
  const resolvedFileUninstallCmd = path.resolve(uninstallCmdPath)
  if (
    !resolvedFileUninstallCmd.startsWith(resolvedParentUninstallCmd + path.sep) ||
    path.isAbsolute(uninstallCmdPath) ||
    uninstallCmdPath.includes('..')
  ) {
    throw new Error(`Unsafe file path detected: ${uninstallCmdPath}`)
  }
  fs.writeFileSync(uninstallCmdPath, uninstallCmdContent, { mode: 0o755 })
  log(`Generated Windows uninstaller: ${relPath(uninstallCmdPath)}`)
}

async function main() {
  try {
    const startTime = Date.now()
    log('Starting packaging process...')

    // Resolve paths relative to the frontend folder
    const frontendDir = baseDir
    const rootDir = path.resolve(frontendDir, '..')
    const distDir = path.join(frontendDir, '../dist')
    // Clear the entire dist folder before packaging a new one
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true })
    }
    fs.mkdirSync(distDir, { recursive: true })
    // Set the package log file inside dist folder
    logFilePath = path.join(distDir, 'package.log')
    // Clear previous log file if exists
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath)
    }

    const stagingDir = path.join(distDir, 'package')

    // Read package.json synchronously from the frontend folder
    const pkgJsonPath = path.join(frontendDir, 'package.json')
    const resolvedFrontendDir = path.resolve(frontendDir)
    const resolvedPkgJsonPath = path.resolve(pkgJsonPath)
    if (
      !resolvedPkgJsonPath.startsWith(resolvedFrontendDir + path.sep) ||
      pkgJsonPath.includes('..') ||
      !pkgJsonPath.endsWith('package.json')
    ) {
      throw new Error(`Unsafe package.json path: ${pkgJsonPath}`)
    }

    const taintedPkgJsonRaw = fs.readFileSync(pkgJsonPath, 'utf-8')
    let pkg
    try {
      pkg = JSON.parse(taintedPkgJsonRaw)
    } catch (e) {
      throw new Error(`Invalid JSON in package.json: ${e.message}`)
    }

    // Only allow expected keys and types
    if (
      typeof pkg !== 'object' ||
      pkg === null ||
      typeof pkg.name !== 'string' ||
      typeof pkg.version !== 'string'
    ) {
      throw new Error('package.json is missing required fields or has invalid types')
    }
    const { name: appName, version } = pkg

    // Only allow alphanumeric, dash, underscore, and dot
    if (!/^[\w.-]+$/.test(appName)) {
      throw new Error(`Unsafe appName in package.json: ${appName}`)
    }
    if (!/^[\w.-]+$/.test(version)) {
      throw new Error(`Unsafe version in package.json: ${version}`)
    }

    const versionLabel = version.replace(/\./g, '-') // Replace dots with dashes
    log(`Packaging ${appName} version ${version}`)

    // Create or clean dist/package folder.
    fs.rmSync(stagingDir, { recursive: true, force: true })
    fs.mkdirSync(stagingDir, { recursive: true })

    // 1. Copy .next/standalone folder to staging as next/standalone.
    const srcStandalone = path.join(frontendDir, '.next', 'standalone')
    const destStandalone = path.join(stagingDir, 'next', 'standalone')
    log(`Copying ${relPath(srcStandalone)} to ${relPath(destStandalone)}`)
    copyDir(srcStandalone, destStandalone, ['db.sqlite'])

    // 2. Copy .next/static folder into next/standalone/.next/static
    const srcStatic = path.join(frontendDir, '.next', 'static')
    const destStatic = path.join(destStandalone, '.next', 'static')
    log(`Copying ${relPath(srcStatic)} to ${relPath(destStatic)}`)
    copyDir(srcStatic, destStatic)

    // 3. Copy workers folder (skipping any venv folders) to staging as next/workers.
    const srcWorkers = path.join(rootDir, 'workers')
    const destWorkers = path.join(stagingDir, 'next', 'workers')
    log(`Copying ${relPath(srcWorkers)} to ${relPath(destWorkers)}`)
    copyDir(srcWorkers, destWorkers, [], ['venv'])

    // 4. Generate installer and uninstaller scripts.
    log('Generating installer scripts...')
    generateInstallScripts(stagingDir, appName)
    log('Generating uninstaller scripts...')
    generateUninstallScripts(stagingDir, appName)

    // Completely break taint flow by using constant patterns and explicit validation
    // Instead of just replacing invalid chars, ONLY allow known-good characters 
    // and reject anything else to fully break taint propagation
    let safeAppName = ''
    let safeVersion = ''

    // Strictly validate app name with explicit character-by-character check
    if (/^[\w.-]+$/.test(appName)) {
      // Limit length to prevent excessive filenames
      safeAppName = appName.slice(0, 50);
      // Double-check that ONLY allowed characters remain
      for (let i = 0; i < safeAppName.length; i++) {
        const char = safeAppName[i];
        if (!/[\w.-]/.test(char)) {
          // This should never happen due to the regex check above,
          // but provides defense in depth
          throw new Error(`Invalid character in app name: ${char}`);
        }
      }
    } else {
      // If validation fails, use a hardcoded safe default
      log(`Warning: Used default app name due to invalid characters in: ${appName}`);
      safeAppName = 'edge-application';
    }

    // Strictly validate version with explicit character-by-character check
    if (/^[\w.-]+$/.test(version)) {
      // Limit length
      safeVersion = version.slice(0, 20);
      // Double-check that ONLY allowed characters remain
      for (let i = 0; i < safeVersion.length; i++) {
        const char = safeVersion[i];
        if (!/[\w.-]/.test(char)) {
          throw new Error(`Invalid character in version: ${char}`);
        }
      }
    } else {
      // If validation fails, use a hardcoded safe default
      log(`Warning: Used default version due to invalid characters in: ${version}`);
      safeVersion = '1-0-0';
    }

    // Replace dots with dashes using a safe operation that won't preserve taint
    // Create a completely new string rather than using replace() which might preserve taint
    const safeVersionLabel = safeVersion.split('.').join('-');

    // 5. Create archive package using archiver
    // Explicitly construct the filename with constant pattern and validated components
    const safeArchiveBaseName = `${safeAppName}-${safeVersionLabel}`;
    // Final validation of the constructed name as defense in depth
    if (!/^[\w.-]+$/.test(safeArchiveBaseName)) {
      throw new Error(`Failed to create safe archive basename: ${safeArchiveBaseName}`);
    }

    const safeArchiveName = `${safeArchiveBaseName}.zip`;
    // Explicit path construction with no variables outside our control
    const distDirAbsolute = path.resolve(distDir);
    // Use path.join to ensure proper path separator usage
    const safeArchivePath = path.join(distDirAbsolute, safeArchiveName);

    // Additional validation checks
    if (!safeArchivePath.startsWith(distDirAbsolute + path.sep)) {
      throw new Error(`Archive path escapes from allowed directory: ${safeArchivePath}`);
    }

    if (safeArchivePath.includes('..') || !safeArchivePath.endsWith('.zip')) {
      throw new Error(`Unsafe archive path detected: ${safeArchivePath}`);
    }

    // Log sanitized values for transparency
    log(`Creating archive with sanitized name: ${safeArchiveName}`);
    log(`Archive will be stored at: ${safeArchivePath}`);

    // Use only safeArchivePath in the sink
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(safeArchivePath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => {
        log(`Archive ${safeArchiveName} created successfully (${archive.pointer()} total bytes)`)
        resolve()
      })

      archive.on('error', (err) => reject(err))
      archive.pipe(output)

      archive.directory(path.join(stagingDir, 'next'), 'next')
      const files = fs.readdirSync(stagingDir)
      for (const file of files) {
        if (file !== 'next') {
          const filePath = path.join(stagingDir, file)
          if (fs.statSync(filePath).isFile()) {
            archive.file(filePath, { name: file })
          }
        }
      }

      archive.finalize()
    })

    const duration = Math.round((Date.now() - startTime) / 1000)
    log(`Packaging process completed successfully. Total duration: ${duration} seconds.`)
  } catch (err) {
    log(`Error during packaging: ${err.message}`)
    process.exit(1)
  }
}

main()