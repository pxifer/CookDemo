param([switch]$DiagnoseOnly,[switch]$RetryFailed,[string]$Report)
$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run.ps1'
$projectRoot = Split-Path -Parent $PSScriptRoot
Write-Host '本脚本用于你自行打开的普通 PowerShell。只做本地诊断/验收，不部署，不调用付费模型。'
Write-Host '完整验收会在已有隔离本地测试数据库运行测试；请先打开 Docker Desktop。不要填写正式数据库。'
Write-Host '已启用仅本地策略：公网HTTP拦截、模型/邮箱模拟，不需要CloudBase测试环境，不读取真实Key。'
if ($DiagnoseOnly) { & $runner -Task diagnose; exit $LASTEXITCODE }
if ($RetryFailed) {
  if (!$Report) {
    $runs = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'artifacts/acceptance') -Directory -Filter 'project-check-*' | Sort-Object Name -Descending
    foreach ($run in $runs) {
      $candidatePath = Join-Path $run.FullName 'report.json'
      if (!(Test-Path -LiteralPath $candidatePath)) { continue }
      try { $candidate = Get-Content -LiteralPath $candidatePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { continue }
      if ($candidate.sourceStable -eq $true -and @($candidate.results | Where-Object { $_.status -eq 'failed' }).Count -gt 0) { $Report = $candidatePath; break }
    }
  }
  if (!$Report) { throw '没有找到已完成且有失败组的验收报告，请先执行完整检查或指定 -Report。' }
  $resolvedReport = (Resolve-Path -LiteralPath $Report).Path
  Write-Host "补测此前失败组，另跑构建和类型检查。依据报告：$resolvedReport"
  & $runner -Task check -TaskArguments @('--retry-failed',$resolvedReport)
} else {
  if ($Report) { throw '-Report 仅用于 -RetryFailed' }
  & $runner -Task check
}
$checkExitCode = $LASTEXITCODE
if ($checkExitCode -eq 2) { Write-Host '本地检查未全部完成。请查看最新 artifacts/acceptance/project-check-*/report.json 中的 permission_blocked / not_run。' }
elseif ($checkExitCode -ne 0) { Write-Host '有检查失败。请提供最新 report.json 与对应阶段日志，不要提供配置文件或密钥。' }
elseif ($RetryFailed) { Write-Host '本次失败组补测通过。未重跑阶段保留为未执行，不能替代正式发布前的完整验收。' }
else { Write-Host '本地验收通过；真实账户、模型独立评测、隔离恢复和测试环境验收仍单独核验。' }
exit $checkExitCode
