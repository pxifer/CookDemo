param([ValidateSet('Prepare','Start','Inspect','Import','Publish','Withdraw')][string]$Task='Start', [string]$Release='local-business-gallery-v1', [ValidateRange(1024,65535)][int]$Port=4180)
$ErrorActionPreference='Stop'
if ($Release -notmatch '^local-business-[a-z0-9-]{1,60}$') { throw '仅允许local-business构造内容版本' }
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) { $nodeExecutable=(Get-Command node -ErrorAction Stop).Source }
if ((& $nodeExecutable -p 'process.versions.node.split(".")[0]') -ne '24') { throw '需要Node.js 24' }
Push-Location -LiteralPath $projectRoot
$previousRelease=$env:CONTENT_RELEASE_ID; $previousPort=$env:PORT; $previousOrigin=$env:APP_ORIGIN
try {
  if ($Task -eq 'Start') {
    $env:CONTENT_RELEASE_ID=$Release; $env:PORT=[string]$Port; $env:APP_ORIGIN="http://127.0.0.1:$Port"
    & $nodeExecutable --env-file=.local-data/deployment/business-local.env --import tsx server/main.ts
  } else {
    if ($Release -eq 'local-business-gallery-v1') { throw '图鉴联动版本只支持Start；直接只读使用已有候选表，不执行发布或迁移。' }
    & $nodeExecutable --import tsx scripts/content-local.ts $Task.ToLowerInvariant() "--release=$Release"
  }
  if ($LASTEXITCODE -ne 0) { throw '本地业务任务失败，未覆盖原开发库/数据卷；查看稳定错误码' }
} finally { $env:CONTENT_RELEASE_ID=$previousRelease; $env:PORT=$previousPort; $env:APP_ORIGIN=$previousOrigin; Pop-Location }
