[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$HostName = "mailprocessor.host",
    [string]$ExtensionId = "mailprocessor@kopolinfo.ch",
    [switch]$SkipAddonPackage,
    [switch]$SkipBackendBuild
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$addonRoot = Join-Path $ProjectRoot "addon"
$backendRoot = Join-Path $ProjectRoot "backend"
$registerScriptPath = Join-Path $ProjectRoot "scripts\windows\Register-NativeHost.ps1"
$testScriptPath = Join-Path $ProjectRoot "scripts\windows\Test-LocalInstall.ps1"

if (-not (Test-Path $addonRoot)) {
    throw "Add-on folder not found at '$addonRoot'."
}

if (-not (Test-Path $backendRoot)) {
    throw "Backend folder not found at '$backendRoot'."
}

if (-not (Test-Path $registerScriptPath)) {
    throw "Register script not found at '$registerScriptPath'."
}

if (-not (Test-Path $testScriptPath)) {
    throw "Test script not found at '$testScriptPath'."
}

if (-not $SkipAddonPackage) {
    Write-Host "Packaging Thunderbird add-on..."
    Push-Location $addonRoot
    try {
        & npm.cmd run package
        if ($LASTEXITCODE -ne 0) {
            throw "Add-on packaging failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

if (-not $SkipBackendBuild) {
    Write-Host "Building native host backend..."
    Push-Location $backendRoot
    try {
        & .\gradlew.bat installDist
        if ($LASTEXITCODE -ne 0) {
            throw "Backend build failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

Write-Host "Registering native host..."
& powershell -ExecutionPolicy Bypass -File $registerScriptPath -ProjectRoot $ProjectRoot -HostName $HostName -ExtensionId $ExtensionId
if ($LASTEXITCODE -ne 0) {
    throw "Native host registration failed with exit code $LASTEXITCODE."
}

Write-Host "Verifying local install..."
& powershell -ExecutionPolicy Bypass -File $testScriptPath -ProjectRoot $ProjectRoot -HostName $HostName -ExtensionId $ExtensionId
if ($LASTEXITCODE -ne 0) {
    throw "Local install verification failed with exit code $LASTEXITCODE."
}

$xpiDirectory = Join-Path $addonRoot "build"
$xpiArtifact = Get-ChildItem -Path $xpiDirectory -Filter *.xpi -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
$manifestPath = Join-Path $ProjectRoot ".native-host\$HostName.json"

Write-Host ""
Write-Host "Local installation artifacts are ready."
if ($xpiArtifact -ne $null) {
    Write-Host "Install this XPI in Thunderbird: $($xpiArtifact.FullName)"
}
Write-Host "Native host manifest: $manifestPath"
Write-Host "Native host registered for extension id: $ExtensionId"
