[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$HostName = "mailprocessor.host"
)

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$manifestPath = Join-Path (Join-Path $ProjectRoot ".native-host") "$HostName.json"
$registryKey = "HKCU\Software\Mozilla\NativeMessagingHosts\$HostName"

if (Test-Path $manifestPath) {
    Remove-Item -Force $manifestPath
}

reg.exe delete $registryKey /f | Out-Null

Write-Host "Native host registration removed for $HostName"
