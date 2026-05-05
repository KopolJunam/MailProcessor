[CmdletBinding()]
param(
    [string]$AddonRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AddonRoot)) {
    $AddonRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$manifestPath = Join-Path $AddonRoot "manifest.json"
$distPath = Join-Path $AddonRoot "dist"
$buildRoot = Join-Path $AddonRoot "build"
$stagingRoot = Join-Path $buildRoot "xpi-staging"

if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found at '$manifestPath'."
}

if (-not (Test-Path $distPath)) {
    throw "dist folder not found at '$distPath'. Run the build first."
}

$manifest = Get-Content $manifestPath | ConvertFrom-Json
$artifactName = "{0}-{1}.xpi" -f $manifest.name, $manifest.version
$artifactPath = Join-Path $buildRoot $artifactName

if (Test-Path $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $stagingRoot "manifest.json")
Copy-Item -LiteralPath $distPath -Destination (Join-Path $stagingRoot "dist") -Recurse

if (Test-Path $artifactPath) {
    Remove-Item -LiteralPath $artifactPath -Force
}

$zipPath = [System.IO.Path]::ChangeExtension($artifactPath, ".zip")
if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipArchive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -LiteralPath $stagingRoot -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($stagingRoot.Length).TrimStart("\").Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zipArchive,
            $_.FullName,
            $relativePath,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zipArchive.Dispose()
}

Move-Item -LiteralPath $zipPath -Destination $artifactPath

Write-Host "XPI created at $artifactPath"
