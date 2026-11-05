param([ValidateSet('Plan','Import','Inspect')][string]$Task='Plan')
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) { $nodeExecutable=(Get-Command node -ErrorAction Stop).Source }
if ((& $nodeExecutable -p 'process.versions.node.split(".")[0]') -ne '24') { throw '需要Node.js 24' }
Push-Location -LiteralPath $projectRoot
try {
  & $nodeExecutable --import tsx scripts/recipe-candidates-local.ts $Task.ToLowerInvariant()
  if ($LASTEXITCODE -ne 0) { throw '候选菜谱本地任务失败；稳定错误码见上方，未触碰其他数据库' }
} finally { Pop-Location }
