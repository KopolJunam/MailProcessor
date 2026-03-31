[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$HostName = "mailprocessor.host",
    [string]$ExtensionId = "mailprocessor@kopolinfo.ch"
)

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$backendRoot = Join-Path $ProjectRoot "backend"
$launcherPath = Join-Path $backendRoot "build\install\mailprocessor-backend\bin\mailprocessor-backend.bat"

if (-not (Test-Path $launcherPath)) {
    throw "Backend launcher not found at '$launcherPath'. Run '.\gradlew.bat installDist' in the backend folder first."
}

$manifestDirectory = Join-Path $ProjectRoot ".native-host"
$manifestPath = Join-Path $manifestDirectory "$HostName.json"
$registryKey = "HKCU\Software\Mozilla\NativeMessagingHosts\$HostName"

New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null

$manifest = @{
    name = $HostName
    description = "MailProcessor Native Messaging Host"
    path = $launcherPath
    type = "stdio"
    allowed_extensions = @($ExtensionId)
} | ConvertTo-Json -Depth 3

Set-Content -Path $manifestPath -Value $manifest -Encoding ASCII
reg.exe add $registryKey /ve /t REG_SZ /d $manifestPath /f | Out-Null

Write-Host "Native host manifest written to $manifestPath"
Write-Host "Registry key updated: $registryKey"
