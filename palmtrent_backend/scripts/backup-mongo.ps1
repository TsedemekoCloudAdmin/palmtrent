param(
  [string]$MongoUri = $env:MONGODB_URI,
  [string]$OutputDir = ".\backups"
)

if (-not $MongoUri) {
  throw "MONGODB_URI is required"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDir "palmtrent-$timestamp"

mongodump --uri="$MongoUri" --out="$target"
Compress-Archive -Path "$target\*" -DestinationPath "$target.zip" -Force
Write-Host "Backup written to $target.zip"
