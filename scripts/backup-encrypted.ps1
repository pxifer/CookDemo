param([switch]$VerifyRestore, [string]$Archive)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodeExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) { $nodeExecutable = (Get-Command node -ErrorAction Stop).Source }
if ((& $nodeExecutable -p 'process.versions.node.split(".")[0]') -ne '24') { throw '需要Node.js 24' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($relative in @('.local-data/backup-keys','.local-data/encrypted-backups','.local-data/restore-work')) {
  $privateDir = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
  if (-not $privateDir.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '备份目录不在项目内' }
  $null = New-Item -ItemType Directory -Force -Path $privateDir
  & icacls $privateDir /inheritance:r /grant:r "${identity}:(OI)(CI)F" /grant:r '*S-1-5-18:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '备份目录权限设置失败；未执行备份' }
}
Push-Location -LiteralPath $projectRoot
$previousAclMarker = $env:SHIWEI_BACKUP_ACL_READY
try {
  $env:SHIWEI_BACKUP_ACL_READY = '1'
  $backupArguments = @('--import','tsx','scripts/backup-encrypted.ts')
  if ($VerifyRestore) { $backupArguments += '--verify-restore' }
  if ($Archive) { $backupArguments += "--archive=$Archive" }
  & $nodeExecutable @backupArguments
  if ($LASTEXITCODE -ne 0) { throw '加密空结构备份失败；查看稳定错误码，不能视为恢复验收通过' }
} finally { $env:SHIWEI_BACKUP_ACL_READY = $previousAclMarker; Pop-Location }
