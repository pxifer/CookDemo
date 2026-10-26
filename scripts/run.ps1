param(
  [ValidateSet('start','build','test','test:e2e','test:business:postgres','test:business:e2e','test:resume:e2e','check','install','db:prepare','db:migrate','db:check','test:postgres','db:cloudbase:prepare','test:cloudbase','capture:evidence')][string]$Task = 'start',
  [string]$EnvFile,
  [switch]$Vector,
  [switch]$AdoptLegacy
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodePath = (Get-Command node).Source
if ((& $nodePath -p 'process.versions.node.split(".")[0]') -ne '24') {
  if (Test-Path -LiteralPath $runtimePath) { $nodePath = $runtimePath }
  else { throw '需要 Node.js 24 LTS。请安装后重新运行。' }
}
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$npmPath = Join-Path (Split-Path -Parent (Get-Command npm).Source) 'node_modules\npm\bin\npm-cli.js'
Push-Location -LiteralPath $projectRoot
try {
  $nodeArgs = @()
  if ($EnvFile) {
    $resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
    $nodeArgs += "--env-file=$resolvedEnvFile"
  }
  $taskArgs = @()
  if ($Vector) { $taskArgs += '--vector' }
  if ($AdoptLegacy) { $taskArgs += '--adopt-legacy' }
  if ($taskArgs.Count -and $Task -notin @('db:migrate','db:check')) { throw '附加开关仅用于 db:migrate/db:check' }
  if ($Task -eq 'install') { & $nodePath @nodeArgs $npmPath ci }
  elseif ($taskArgs.Count) { & $nodePath @nodeArgs $npmPath run $Task -- @taskArgs }
  else { & $nodePath @nodeArgs $npmPath run $Task }
  if ($LASTEXITCODE -ne 0) { throw "任务 $Task 失败，退出码 $LASTEXITCODE" }
} finally { Pop-Location }
