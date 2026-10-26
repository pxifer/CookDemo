$ErrorActionPreference='Stop'
$revision='v19'
$project=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$cli=Join-Path $project '.local-data\tooling\cloudbase-cli\node_modules\@cloudbase\cli\bin\tcb'
$package=Join-Path $project ".local-data\cloudbase-http\release-20261025-account-$revision"
$stdout=Join-Path $package "deploy-$revision.stdout.private.txt";$stderr=Join-Path $package "deploy-$revision.stderr.private.txt"
$arguments=@('"'+$cli+'"','fn','deploy','shiwei-http-preview','--httpFn','--force','--install-dependency','false','--runtime','Nodejs24.11','-e','shiwei-d2gmiun66b7dc6a4f','--region','ap-shanghai','--json','--yes')
$process=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $package -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$exit=$process.ExitCode;$raw=@((Get-Content $stdout -Raw),(Get-Content $stderr -Raw));$joined=$raw -join "`n";$start=$joined.IndexOf('{');$depth=0;$quoted=$false;$escaped=$false;$end=-1
for($i=$start;$i -ge 0 -and $i -lt $joined.Length;$i++){
  $c=$joined[$i]
  if($quoted){if($escaped){$escaped=$false}elseif($c -eq '\'){$escaped=$true}elseif($c -eq '"'){$quoted=$false};continue}
  if($c -eq '"'){$quoted=$true}elseif($c -eq '{'){$depth++}elseif($c -eq '}'){$depth--;if($depth -eq 0){$end=$i;break}}
}
if($start -lt 0 -or $end -lt 0){
  [ordered]@{deployed=$false;exit=$exit;responseRecognized=$false;responseLength=$joined.Length;rawResponseSavedPrivately=$true}|ConvertTo-Json -Compress
  throw '函数发布响应未能验证'
}
$response=$joined.Substring($start,$end-$start+1)|ConvertFrom-Json
$private=Join-Path $package "deploy-result-$revision.private.json"
$response|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $private -Encoding UTF8
if($exit -ne 0 -or $response.error){[ordered]@{deployed=$false;exit=$exit;errorCode=$response.error.code;rawResponseSavedPrivately=$true}|ConvertTo-Json -Compress;throw '函数发布失败'}
$data=$response.data
[ordered]@{deployed=$true;exit=$exit;functionName='shiwei-http-preview';taskStatus=$data.task.status;taskIdPresent=[bool]$data.taskId;rawResponseSavedPrivately=$true}|ConvertTo-Json -Compress

