$ErrorActionPreference='Stop'
$project=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$node=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$cli=Join-Path $project '.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb'
$package=Join-Path $project '.local-data/cloudbase-http/release-20261026-recipe-copy-v29'
$source=Join-Path $project '.local-data/cloudbase-http/release-20261026-listed-foods-v28/cloudbaserc.json'
$configPath=Join-Path $package 'cloudbaserc.json'
if((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $configPath).Hash){throw 'Existing configuration changed'}
$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json
$settings=$config.functions[0].envVariables
$networkEnvironment=@{HTTP_PROXY='';HTTPS_PROXY='';ALL_PROXY='';NO_PROXY='*';TCB_NO_BROWSER='true';NO_UPDATE_NOTIFIER='true'}
function Invoke-PrivateCloud([string]$Label,[string[]]$CloudArguments){
  $stdout=Join-Path $package "$Label.stdout.private.txt";$stderr=Join-Path $package "$Label.stderr.private.txt"
  $arguments=(@($cli)+$CloudArguments|ForEach-Object {'"'+$_.Replace('"','\"')+'"'}) -join ' '
  $process=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $package -Environment $networkEnvironment -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $text=@((Get-Content -LiteralPath $stdout -Raw),(Get-Content -LiteralPath $stderr -Raw)) -join "`n"
  $start=$text.IndexOf('{');$depth=0;$quoted=$false;$escaped=$false;$end=-1
  for($index=$start;$index -ge 0 -and $index -lt $text.Length;$index++){
    $character=$text[$index]
    if($quoted){if($escaped){$escaped=$false}elseif($character -eq '\'){$escaped=$true}elseif($character -eq '"'){$quoted=$false};continue}
    if($character -eq '"'){$quoted=$true}elseif($character -eq '{'){$depth++}elseif($character -eq '}'){$depth--;if($depth -eq 0){$end=$index;break}}
  }
  if($start -lt 0 -or $end -lt 0){throw "$Label response not recognized; private logs retained"}
  $response=$text.Substring($start,$end-$start+1)|ConvertFrom-Json
  if($process.ExitCode -ne 0 -or $response.error){throw "$Label failed ($($response.error.code)); private logs retained"}
  return $response.data
}
$environments=Invoke-PrivateCloud 'preflight-copy' @('env','list','--region','ap-shanghai','--json')
$target=@($environments|Where-Object {$_.EnvId -eq 'shiwei-d2gmiun66b7dc6a4f'})
if($target.Count -ne 1 -or $target[0].PackageId -ne 'baas_trial' -or $target[0].EnableOverrun -ne $false -or $target[0].IsAutoRenew -ne $false -or $target[0].Status -ne 'NORMAL'){throw 'Existing free environment requirements not met'}
$catalog=Invoke-RestMethod -Uri ($settings.APP_ORIGIN+'/api/v1/catalog/recipes') -TimeoutSec 30 -NoProxy
if($catalog.contentVersion -ne $settings.CONTENT_BUNDLE_ID){throw 'Live content differs from preserved configuration'}
[ordered]@{stage='preflight';freePlan=$true;configurationUnchanged=$true;databaseWrites=$false}|ConvertTo-Json -Compress
$deployed=Invoke-PrivateCloud 'function-copy' @('fn','deploy','shiwei-http-preview','--httpFn','--force','--install-dependency','false','--runtime','Nodejs24.11','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json','--yes')
if($deployed.success -ne $true -or @($deployed.results|Where-Object {$_.name -eq 'shiwei-http-preview' -and $_.status -eq 'success'}).Count -ne 1){throw 'Function publication incomplete'}
[ordered]@{stage='function';deployed=$true;configurationUnchanged=$true;databaseWrites=$false}|ConvertTo-Json -Compress
