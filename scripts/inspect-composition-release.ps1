$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envId='shiwei-d2gmiun66b7dc6a4f';$region='ap-shanghai'
$nodeExecutable=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if(-not(Test-Path -LiteralPath $nodeExecutable)){$nodeExecutable=(Get-Command node -ErrorAction Stop).Source}
$cliRoot=Join-Path $projectRoot '.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli';$cli=Join-Path $cliRoot 'bin/tcb'
$sql="SELECT coalesce(jsonb_agg(jsonb_build_object('release_id',release_id,'checksum',checksum,'published',published) ORDER BY release_id),'[]'::jsonb) AS result FROM public.shiwei_gallery_releases WHERE release_id LIKE 'composition-review-20261024-v%';"
Push-Location $projectRoot
try{
  $raw=& $nodeExecutable $cli db execute -e $envId --region $region --role cloudbase_postgres --sql $sql --json;$code=$LASTEXITCODE
  if($code -ne 0){throw 'CloudBase查询失败'}
  $joined=$raw -join "`n";$start=$joined.IndexOf('{');if($start -lt 0){throw 'CloudBase响应无法识别'}
  $response=$joined.Substring($start)|ConvertFrom-Json;if($response.error){throw 'CloudBase查询失败'}
  if(@($response.data.Rows).Count -eq 0){'[]';return}
  $layer=@($response.data.Rows[0]|ConvertFrom-Json)
  $result=@($layer[0]|ConvertFrom-Json)
  @($result|ForEach-Object{@{releaseId=$_.release_id;checksum=$_.checksum;published=$_.published}})|ConvertTo-Json -Compress
}finally{Pop-Location}
