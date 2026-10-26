param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $projectRoot
try {
  & "$PSScriptRoot\run.ps1" 'db:prepare'
  $secretDir = (Resolve-Path -LiteralPath '.local-data/deployment').Path
  if (-not $secretDir.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '配置目录不在当前项目内' }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $secretDir /inheritance:r /grant:r "${identity}:(OI)(CI)F" /grant:r '*S-1-5-18:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '本地配置权限设置失败，未启动数据库' }
  if ($PrepareOnly) { Write-Output '配置准备完成；数据库尚未创建。'; return }
  $dockerExecutable = (Get-Command docker -ErrorAction SilentlyContinue).Source
  if (-not $dockerExecutable) {
    $dockerExecutable = @('C:\Program Files\Docker\Docker\resources\bin\docker.exe', "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
  if (-not $dockerExecutable) { throw '未发现 Docker。请安装并启动 Docker Desktop；配置已保留。' }
  # Desktop's credential helper lives beside docker.exe; a newly installed Desktop
  # may not yet be on the parent app's PATH. Keep this adjustment process-local.
  $env:PATH = (Split-Path -Parent $dockerExecutable) + ';' + $env:PATH
  $dockerOsType = & $dockerExecutable info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0 -or $dockerOsType -ne 'linux') { throw 'Docker Linux 引擎未就绪' }
  $compose = @('compose','--project-directory',$projectRoot,'-f','deploy/compose.local.yml')
  & $dockerExecutable @compose up -d --wait db
  if ($LASTEXITCODE -ne 0) { throw '数据库启动未通过；保留数据卷，不自动删除或重建' }
  & "$PSScriptRoot\run.ps1" 'db:migrate' -EnvFile '.local-data/deployment/migration.env' -Vector
  & $dockerExecutable @compose cp 'deploy/db/runtime-grants.sql' 'db:/tmp/runtime-grants.sql'
  if ($LASTEXITCODE -ne 0) { throw '授权脚本复制失败' }
  & $dockerExecutable @compose exec -T db psql -U shiwei_owner -d shiwei_dev -v ON_ERROR_STOP=1 -f /tmp/runtime-grants.sql
  if ($LASTEXITCODE -ne 0) { throw '运行角色授权失败' }
  & "$PSScriptRoot\run.ps1" 'db:check' -EnvFile '.local-data/deployment/local.env' -Vector
  Write-Output '本地数据库与空表检查完成；正式内容、认证和模型仍未开放。'
} finally { Pop-Location }
