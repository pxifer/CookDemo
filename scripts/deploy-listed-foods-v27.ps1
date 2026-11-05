param([ValidateSet('Plan','Apply','Function')][string]$Task='Plan',[ValidateSet('v27','v28','v29')][string]$Revision='v27')
$ErrorActionPreference='Stop'
$project=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$node=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$cli=Join-Path $project '.local-data/tooling/cloudbase-cli/node_modules/@deployment/cloudbase/cli/bin/tcb'
$package=Join-Path $project $(if($Revision -eq 'v29'){'.local-data/cloudbase-http/release-20261027-recipe-methods-v29'}else{".local-data/cloudbase-http/release-20261026-listed-foods-$Revision"})
$migration=Join-Path $project $(if($Revision -eq 'v29'){'.local-data/cloudbase-http/listed-foods-20261026-v28/migration'}else{'.local-data/cloudbase-http/listed-foods-20261026-v27/migration'})
$expectedMigration=if($Revision -eq 'v29'){'20261027120000'}else{'20261026120000'}
$networkEnvironment=@{HTTP_PROXY='';HTTPS_PROXY='';ALL_PROXY='';NO_PROXY='*';TCB_NO_BROWSER='true';NO_UPDATE_NOTIFIER='true'}
function Invoke-PrivateCloud([string]$Label,[string[]]$CloudArguments,[string]$Directory=$package){
  $stdout=Join-Path $package "$Label.stdout.private.txt";$stderr=Join-Path $package "$Label.stderr.private.txt"
  $arguments=(@($cli)+$CloudArguments|ForEach-Object {'"'+$_.Replace('"','\"')+'"'}) -join ' '
  $process=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $Directory -Environment $networkEnvironment -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $text=@((Get-Content -LiteralPath $stdout -Raw),(Get-Content -LiteralPath $stderr -Raw)) -join "`n"
  $start=$text.IndexOf('{');$depth=0;$quoted=$false;$escaped=$false;$end=-1
  for($index=$start;$index -ge 0 -and $index -lt $text.Length;$index++){
    $character=$text[$index]
    if($quoted){if($escaped){$escaped=$false}elseif($character -eq '\'){$escaped=$true}elseif($character -eq '"'){$quoted=$false};continue}
    if($character -eq '"'){$quoted=$true}elseif($character -eq '{'){$depth++}elseif($character -eq '}'){$depth--;if($depth -eq 0){$end=$index;break}}
  }
  if($start -lt 0 -or $end -lt 0){throw "$Label response not recognized; private logs retained"}
  $response=$text.Substring($start,$end-$start+1)|ConvertFrom-Json
  $response|ConvertTo-Json -Depth 40|Set-Content -LiteralPath (Join-Path $package "$Label.result.private.json") -Encoding utf8
  if($process.ExitCode -ne 0 -or $response.error){throw "$Label failed ($($response.error.code)); private logs retained"}
  return $response.data
}
$environments=Invoke-PrivateCloud 'preflight-v27' @('env','list','--region','ap-shanghai','--json')
$target=@($environments|Where-Object {$_.EnvId -eq 'shiwei-d2gmiun66b7dc6a4f'})
if($target.Count -ne 1 -or $target[0].PackageId -ne 'baas_trial' -or $target[0].EnableOverrun -ne $false -or $target[0].IsAutoRenew -ne $false -or $target[0].Status -ne 'NORMAL'){throw 'Environment no longer meets existing free deployment requirements'}
if($Task -ne 'Function'){
$dry=Invoke-PrivateCloud 'migration-plan-v27' @('db','pg','migration','up','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--dry-run','--json') $migration
$pending=@($dry.pending)
if(-not $dry.executable -or $pending.Count -ne 1 -or $pending[0].Version -ne $expectedMigration){throw 'Migration plan differs from the reviewed single append-only migration'}
[ordered]@{stage='plan';freePlan=$true;overrunDisabled=$true;pending=1;version=$pending[0].Version;revision=$Revision}|ConvertTo-Json -Compress
if($Task -eq 'Plan'){return}
$applied=Invoke-PrivateCloud 'migration-up-v27' @('db','pg','migration','up','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json') $migration
if(-not $applied.executable -or $applied.conflicts.Count -ne 0 -or $applied.task.status -ne 'Succeed'){throw 'Database migration did not confirm success'}
[ordered]@{stage='database';status=$applied.task.status;version=$expectedMigration;revision=$Revision}|ConvertTo-Json -Compress
}
$deployed=Invoke-PrivateCloud "function-$Revision" @('fn','deploy','shiwei-http-preview','--httpFn','--force','--install-dependency','false','--runtime','Nodejs24.11','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json','--yes')
if($deployed.success -ne $true -or @($deployed.results|Where-Object {$_.name -eq 'shiwei-http-preview' -and $_.status -eq 'success'}).Count -ne 1){throw 'Function publication incomplete'}
[ordered]@{stage='function';revision=$Revision;deployed=$true;existingKeysPreserved=$true}|ConvertTo-Json -Compress
