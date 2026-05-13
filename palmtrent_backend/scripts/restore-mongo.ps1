param(
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [string]$MongoUri = $env:MONGODB_URI
)

if (-not $MongoUri) {
  throw "MONGODB_URI is required"
}

mongorestore --uri="$MongoUri" --drop "$BackupPath"
Write-Host "Restore completed from $BackupPath"
