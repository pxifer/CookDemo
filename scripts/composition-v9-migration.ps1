param([ValidateSet('Plan','Apply')][string]$Task='Plan')
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envId='shiwei-d2gmiun66b7dc6a4f';$region='ap-shanghai'
$migrationRoot=Join-Path $projectRoot '.local-data/cloudbase-http/composition-review-20261025-v9/migration'
$nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if(-not(Test-Path -LiteralPath $nodeExecutable)){$nodeExecutable=(Get-Command node -ErrorAction Stop).Source}
if((& $nodeExecutable -p 'process.versions.node.split(".")[0]') -ne '24'){throw '需要Node.js 24'}
$cliRoot=Join-Path $projectRoot '.local-data/tooling/cloudbase-cli/node_modules/@deployment/cloudbase/cli'
$pkg=Get-Content -LiteralPath (Join-Path $cliRoot 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($pkg.name -ne '@deployment/cloudbase/cli' -or $pkg.version -ne '3.8.7'){throw '需要已核验的CloudBase CLI 3.8.7'}
$cli=Join-Path $cliRoot 'bin/tcb';$env:TCB_NO_BROWSER='true';$env:NO_UPDATE_NOTIFIER='true'
function Invoke-Cloud([string[]]$cloudArguments){
  $output=& $nodeExecutable $cli @cloudArguments;$exit=$LASTEXITCODE;$joined=$output -join "`n";$start=$joined.IndexOf('{')
  if($start -lt 0){throw "CloudBase响应无法识别（退出码$exit，响应长度$($joined.Length)）"}
  try{$parsed=$joined.Substring($start)|ConvertFrom-Json}catch{throw 'CloudBase响应格式异常'}
  if($parsed.error -or $exit -ne 0){throw "CloudBase迁移操作失败（$($parsed.error.code)）"}
  return $parsed
}
$envResult=Invoke-Cloud @('env','list','--region',$region,'--json')
$target=@($envResult.data|Where-Object{$_.EnvId -eq $envId})
if($target.Count -ne 1 -or $target[0].PackageId -ne 'baas_trial' -or $target[0].EnableOverrun -ne $false -or $target[0].IsAutoRenew -ne $false -or $target[0].Status -ne 'NORMAL'){throw '目标环境免费边界已变化，停止操作'}
Push-Location -LiteralPath $migrationRoot
try{
  $dry=Invoke-Cloud @('db','pg','migration','up','-e',$envId,'--region',$region,'--dry-run','--json')
  if(-not $dry.data.executable){throw '迁移预演未通过'}
  $pending=@($dry.data.pending)
  $dry|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $migrationRoot 'dry-run-v9.private.json') -Encoding UTF8
  if($pending.Count -ne 1 -or $pending[0].Name -ne 'composition_source_review_expanded' -or $pending[0].Version -ne '20261025100000'){
    [ordered]@{task='plan';environmentId=$envId;region=$region;freeBoundary=$true;pending=@($pending|ForEach-Object{@{name=$_.Name;version=$_.Version;status=$_.Status}});matchesExpected=$false;rawResponseSavedPrivately=$true}|ConvertTo-Json -Compress
    throw '待执行迁移与预期不符'
  }
  if($Task -eq 'Plan'){
    [ordered]@{task='plan';environmentId=$envId;region=$region;freeBoundary=$true;pending=$pending.Count;expectedMigration=$pending[0].Name;readOnly=$true}|ConvertTo-Json -Compress
    return
  }
  $result=Invoke-Cloud @('db','pg','migration','up','-e',$envId,'--region',$region,'--json')
  if(-not $result.data.executable -or $result.data.conflicts.Count -ne 0 -or $result.data.task.status -ne 'Succeed'){throw '迁移未确认成功'}
  $privatePath=Join-Path $migrationRoot 'up-result-v9.private.json'
  $result|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $privatePath -Encoding UTF8
  [ordered]@{task='apply';environmentId=$envId;region=$region;freeBoundary=$true;migration=$pending[0].Name;status=$result.data.task.status;rawResponseSavedPrivately=$true}|ConvertTo-Json -Compress
}finally{Pop-Location}


