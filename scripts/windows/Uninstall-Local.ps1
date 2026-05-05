[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$HostName = "mailprocessor.host"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$unregisterScriptPath = Join-Path $ProjectRoot "scripts\windows\Unregister-NativeHost.ps1"

if (-not (Test-Path $unregisterScriptPath)) {
    throw "Unregister script not found at '$unregisterScriptPath'."
}

Write-Host "Removing native host registration..."
& powershell -ExecutionPolicy Bypass -File $unregisterScriptPath -ProjectRoot $ProjectRoot -HostName $HostName
if ($LASTEXITCODE -ne 0) {
    throw "Native host unregister failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Local uninstall completed."
Write-Host "If installed, remove the add-on itself in Thunderbird via Add-ons and Themes."
