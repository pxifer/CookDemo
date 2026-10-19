param([ValidateSet('start','build','test','test:e2e','check','install')][string]$Task = 'start')
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
  if ($Task -eq 'install') { & $nodePath $npmPath ci }
  else { & $nodePath $npmPath run $Task }
  if ($LASTEXITCODE -ne 0) { throw "任务 $Task 失败，退出码 $LASTEXITCODE" }
} finally { Pop-Location }
