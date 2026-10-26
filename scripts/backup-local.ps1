param([switch]$VerifyRestore)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $projectRoot
$probeName = $null
$probeCreated = $false
$compose = @('compose','--project-directory',$projectRoot,'-f','deploy/compose.local.yml')
$suffix = [guid]::NewGuid().ToString('N')
$containerDump = "/tmp/shiwei-$suffix.dump"
$containerList = "/tmp/shiwei-$suffix.list"
$dockerExecutable = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $dockerExecutable) {
  $dockerExecutable = @('C:\Program Files\Docker\Docker\resources\bin\docker.exe', "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
try {
  if (-not $dockerExecutable) { throw '请先安装 Docker 并运行 setup-local.ps1' }
  $env:PATH = (Split-Path -Parent $dockerExecutable) + ';' + $env:PATH
  # This unencrypted local tool is only for EMPTY structural deployments.
  $countSql = 'SELECT (SELECT count(*) FROM accounts)+(SELECT count(*) FROM public_releases);'
  $dataCount = & $dockerExecutable @compose exec -T db psql -U postgres -d shiwei_dev -At -v ON_ERROR_STOP=1 -c $countSql
  if ($LASTEXITCODE -ne 0 -or $dataCount.Trim() -ne '0') { throw '此脚本仅用于无账户/无内容的本地空结构；真实资料须先落实加密备份与撤销恢复方案' }
  $backupDir = Join-Path $projectRoot '.local-data/backups'
  $null = New-Item -ItemType Directory -Force -Path $backupDir
  $backupPath = Join-Path $backupDir "shiwei-$suffix.dump"
  & $dockerExecutable @compose exec -T db pg_dump -U postgres -d shiwei_dev -Fc --no-owner -n public -f $containerDump
  if ($LASTEXITCODE -ne 0) { throw '数据库导出失败' }
  & $dockerExecutable @compose cp "db:$containerDump" $backupPath
  if ($LASTEXITCODE -ne 0) { throw '归档复制失败' }
  if ($VerifyRestore) {
    $probeName = "shiwei_restore_$suffix"
    & $dockerExecutable @compose exec -T db createdb -U postgres -T template0 $probeName
    if ($LASTEXITCODE -ne 0) { throw '隔离恢复库创建失败' }
    $probeCreated = $true
    & $dockerExecutable @compose exec -T db psql -U postgres -d $probeName -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector;'
    if ($LASTEXITCODE -ne 0) { throw '恢复库扩展创建失败' }
    # template0 already has public, which the vector extension also needs.
    # Keep that schema and omit only its CREATE entry from the restore TOC.
    $restoreList = & $dockerExecutable @compose exec -T db pg_restore --list $containerDump
    if ($LASTEXITCODE -ne 0) { throw '读取恢复目录失败' }
    $filteredList = @($restoreList | Where-Object { $_ -notmatch '^\d+;.*\sSCHEMA - public\s' })
    $localList = "$backupPath.list"
    [IO.File]::WriteAllText($localList, ($filteredList -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    & $dockerExecutable @compose cp $localList "db:$containerList"
    if ($LASTEXITCODE -ne 0) { throw '恢复目录复制失败' }
    & $dockerExecutable @compose exec -T db pg_restore -U postgres -d $probeName --no-owner --no-privileges --exit-on-error --use-list $containerList $containerDump
    if ($LASTEXITCODE -ne 0) { throw '隔离恢复失败' }
    $restoredVersions = & $dockerExecutable @compose exec -T db psql -U postgres -d $probeName -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM schema_migrations WHERE checksum IS NOT NULL;'
    if ($LASTEXITCODE -ne 0 -or [int]$restoredVersions -lt 2) { throw '恢复后迁移检查失败' }
    $sourceTables = & $dockerExecutable @compose exec -T db psql -U postgres -d shiwei_dev -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
    if ($LASTEXITCODE -ne 0) { throw '读取原结构数量失败' }
    $restoredTables = & $dockerExecutable @compose exec -T db psql -U postgres -d $probeName -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
    if ($LASTEXITCODE -ne 0 -or [int]$restoredTables -ne [int]$sourceTables) { throw '恢复后表数量不一致' }
  }
  $receipt = @{ checkedAt = [DateTimeOffset]::UtcNow.ToString('o'); kind = 'local-empty-structure-only'; sha256 = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash; restoreChecked = [bool]$VerifyRestore }
  if ($VerifyRestore) { $receipt.restoredTables = [int]$restoredTables; $receipt.migrationVersions = [int]$restoredVersions }
  $receipt | ConvertTo-Json | Set-Content -LiteralPath "$backupPath.json" -Encoding utf8
  Write-Output '空结构备份完成；结果存于 .local-data/backups。不是含真实资料/认证/撤销日志的全系统恢复验收。'
} finally {
  if ($dockerExecutable) {
    if ($probeCreated -and $probeName -match '^shiwei_restore_[a-f0-9]{32}$') { & $dockerExecutable @compose exec -T db dropdb -U postgres --if-exists $probeName }
    if ($containerDump -match '^/tmp/shiwei-[a-f0-9]{32}\.dump$') { & $dockerExecutable @compose exec -T db rm -f $containerDump }
    if ($containerList -match '^/tmp/shiwei-[a-f0-9]{32}\.list$') { & $dockerExecutable @compose exec -T db rm -f $containerList }
  }
  Pop-Location
}
