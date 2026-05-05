[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$HostName = "mailprocessor.host",
    [string]$ExtensionId = "mailprocessor@kopolinfo.ch"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$addonBuildRoot = Join-Path $ProjectRoot "addon\build"
$backendLauncherPath = Join-Path $ProjectRoot "backend\build\install\mailprocessor-backend\bin\mailprocessor-backend.bat"
$manifestPath = Join-Path $ProjectRoot ".native-host\$HostName.json"
$registryPath = "Registry::HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\$HostName"

$xpiArtifact = Get-ChildItem -Path $addonBuildRoot -Filter *.xpi -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

$manifestExists = Test-Path $manifestPath
$backendExists = Test-Path $backendLauncherPath
$registryExists = Test-Path $registryPath
$registryValue = $null

if ($registryExists) {
    $registryValue = (Get-Item -Path $registryPath).GetValue("")
}

$manifest = $null
if ($manifestExists) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
}

$checks = @(
    [pscustomobject]@{
        Name = "XPI artifact exists"
        Ok = ($null -ne $xpiArtifact)
        Details = if ($null -ne $xpiArtifact) { $xpiArtifact.FullName } else { "No .xpi file found in addon\build" }
    },
    [pscustomobject]@{
        Name = "Backend launcher exists"
        Ok = $backendExists
        Details = $backendLauncherPath
    },
    [pscustomobject]@{
        Name = "Native host manifest exists"
        Ok = $manifestExists
        Details = $manifestPath
    },
    [pscustomobject]@{
        Name = "Native host registry key exists"
        Ok = $registryExists
        Details = if ($registryExists) { $registryValue } else { $registryPath }
    },
    [pscustomobject]@{
        Name = "Registry points to manifest"
        Ok = $registryExists -and $manifestExists -and ($registryValue -eq $manifestPath)
        Details = "Registry='$registryValue' Manifest='$manifestPath'"
    },
    [pscustomobject]@{
        Name = "Manifest allows extension id"
        Ok = ($null -ne $manifest) -and ($manifest.allowed_extensions -contains $ExtensionId)
        Details = if ($null -ne $manifest) { ($manifest.allowed_extensions -join ", ") } else { "Manifest missing" }
    },
    [pscustomobject]@{
        Name = "Manifest path matches backend launcher"
        Ok = ($null -ne $manifest) -and ($manifest.path -eq $backendLauncherPath)
        Details = if ($null -ne $manifest) { $manifest.path } else { "Manifest missing" }
    }
)

$checks | ForEach-Object {
    $status = if ($_.Ok) { "OK" } else { "FAIL" }
    Write-Host ("[{0}] {1}: {2}" -f $status, $_.Name, $_.Details)
}

if ($checks.Ok -contains $false) {
    throw "Local install verification failed."
}

Write-Host ""
Write-Host "Local install verification succeeded."
