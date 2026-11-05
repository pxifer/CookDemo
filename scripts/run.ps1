param(
  [ValidateSet('start','build','test','test:local','test:e2e','test:health:e2e','test:rag:e2e','test:registration:e2e','test:business:postgres','test:business:e2e','test:resume:e2e','check','pr:status','pr:check','diagnose','release:check','release:prepare','evaluation:prepare','evaluation:freeze','evaluation:candidates','backup:business','restore:business','test:health:postgres','test:community:postgres','install','db:prepare','db:migrate','db:check','test:postgres','db:cloudbase:prepare','test:cloudbase','rag:prepare','rag:index','rag:query','rag:evaluate','rag:smoke','rag:business:evaluate','capture:evidence','health:verify','health:import-local','health:evaluate','health:recipe-demo','ai:evaluate')][string]$Task = 'start',
  [string]$EnvFile,
  [switch]$Vector,
  [switch]$AdoptLegacy,
  [string[]]$TaskArguments = @()
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $runtimePath }
$nodeVersion = if (Test-Path -LiteralPath $nodePath) { & $nodePath --version } else { '' }
if ($nodeVersion -notmatch '^v24\.') {
  if (Test-Path -LiteralPath $runtimePath) { $nodePath = $runtimePath }
  else { throw '需要 Node.js 24 LTS。请安装后重新运行。' }
}
$selectedNodeVersion = & $nodePath --version
if ($selectedNodeVersion -notmatch '^v24\.') { throw '需要 Node.js 24 LTS。已选运行时版本不符合要求。' }
Write-Host "使用 Node.js $selectedNodeVersion"
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$npmPath = Join-Path (Split-Path -Parent $nodePath) 'node_modules\npm\bin\npm-cli.js'
if (!(Test-Path -LiteralPath $npmPath)) {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if (!$npmCommand) { throw '未找到 npm。请安装 Node.js 24 的完整运行时。' }
  $npmPath = Join-Path (Split-Path -Parent $npmCommand.Source) 'node_modules\npm\bin\npm-cli.js'
}
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
  $taskArgs += $TaskArguments
  # npm can normalize lifecycle exit codes. These acceptance commands preserve
  # exit 2 (incomplete) separately from exit 1 (failed).
  $directTasks = @{
    'check' = @('scripts/check-project.ts')
    'pr:status' = @('scripts/pr-check.ts','status')
    'pr:check' = @('scripts/pr-check.ts','check')
    'test:local' = @('scripts/check-project.ts')
    'diagnose' = @('scripts/diagnose-environment.ts')
    'release:check' = @('scripts/release-readiness.ts')
    'release:prepare' = @('scripts/prepare-release-candidate.ts')
    'evaluation:prepare' = @('scripts/build-evaluation-set.ts')
    'evaluation:freeze' = @('scripts/freeze-evaluation-set.ts')
    'evaluation:candidates' = @('scripts/evaluate-agent-candidates.ts')
    'backup:business' = @('scripts/business-snapshot.ts','backup')
    'restore:business' = @('scripts/business-snapshot.ts','restore')
  }
  if ($directTasks.ContainsKey($Task)) { $scriptArgs = $directTasks[$Task]; & $nodePath @nodeArgs 'node_modules/tsx/dist/cli.mjs' @scriptArgs @taskArgs }
  elseif ($Task -eq 'install') { & $nodePath @nodeArgs $npmPath ci }
  elseif ($taskArgs.Count) { & $nodePath @nodeArgs $npmPath run $Task -- @taskArgs }
  else { & $nodePath @nodeArgs $npmPath run $Task }
  $taskExitCode = $LASTEXITCODE
} finally { Pop-Location }
exit $taskExitCode
