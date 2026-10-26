$ErrorActionPreference='Stop'
$project=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$cli=Join-Path $project '.local-data\tooling\cloudbase-cli\node_modules\@cloudbase\cli\bin\tcb'
$package=Join-Path $project '.local-data\cloudbase-http\release-20261026-swap-images-v26'
$networkEnvironment=@{HTTP_PROXY='';HTTPS_PROXY='';ALL_PROXY='';NO_PROXY='*'}
function Invoke-PrivateCloud([string]$Label,[string[]]$CloudArguments){
  $stdout=Join-Path $package "$Label.stdout.private.txt";$stderr=Join-Path $package "$Label.stderr.private.txt"
  $arguments=@('"'+$cli+'"')+$CloudArguments
  $process=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $package -Environment $networkEnvironment -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $text=@((Get-Content $stdout -Raw),(Get-Content $stderr -Raw)) -join "`n"
  $start=$text.IndexOf('{');$depth=0;$quoted=$false;$escaped=$false;$end=-1
  for($index=$start;$index -ge 0 -and $index -lt $text.Length;$index++){
    $character=$text[$index]
    if($quoted){if($escaped){$escaped=$false}elseif($character -eq '\'){$escaped=$true}elseif($character -eq '"'){$quoted=$false};continue}
    if($character -eq '"'){$quoted=$true}elseif($character -eq '{'){$depth++}elseif($character -eq '}'){$depth--;if($depth -eq 0){$end=$index;break}}
  }
  if($start -lt 0 -or $end -lt 0){throw "$Label response not recognized; private logs retained"}
  $response=$text.Substring($start,$end-$start+1)|ConvertFrom-Json
  $response|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $package "$Label.result.private.json") -Encoding utf8
  if($process.ExitCode -ne 0 -or $response.error){[ordered]@{stage=$Label;success=$false;errorCode=$response.error.code}|ConvertTo-Json -Compress;throw "$Label failed"}
  return $response.data
}
$environments=Invoke-PrivateCloud 'preflight-v26' @('env','list','--region','ap-shanghai','--json')
$target=@($environments|Where-Object {$_.EnvId -eq 'shiwei-d2gmiun66b7dc6a4f'})
if($target.Count -ne 1 -or $target[0].PackageId -ne 'baas_trial' -or $target[0].EnableOverrun -ne $false -or $target[0].IsAutoRenew -ne $false -or $target[0].Status -ne 'NORMAL'){throw 'Environment no longer meets existing free deployment requirements'}
[ordered]@{stage='preflight';freePlan=$true;overrunDisabled=$true;autoRenewDisabled=$true}|ConvertTo-Json -Compress
$assets=Invoke-PrivateCloud 'images-v26' @('hosting','deploy','images','assets/recipes','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--verify','--json','--yes')
if($assets.totalFiles -ne 110 -or $assets.successCount -ne 110 -or $assets.failedCount -ne 0 -or $assets.verified -ne $true){throw 'Static image upload incomplete'}
[ordered]@{stage='images';files=$assets.successCount;verified=$assets.verified}|ConvertTo-Json -Compress
$deployed=Invoke-PrivateCloud 'function-v26' @('fn','deploy','shiwei-http-preview','--httpFn','--force','--install-dependency','false','--runtime','Nodejs24.11','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json','--yes')
if($deployed.success -ne $true -or @($deployed.results|Where-Object {$_.name -eq 'shiwei-http-preview' -and $_.status -eq 'success'}).Count -ne 1){throw 'Function publication incomplete'}
[ordered]@{stage='function';revision='v26';name='shiwei-http-preview';deployed=$true;existingKeysPreserved=$true}|ConvertTo-Json -Compress
