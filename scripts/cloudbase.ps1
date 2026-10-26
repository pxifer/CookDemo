param([ValidateSet('Inspect','Capabilities','Plan','Apply','History','Login')][string]$Task = 'Inspect')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$targetEnv = 'shiwei-d2gmiun66b7dc6a4f'
$targetRegion = 'ap-shanghai'
$nodeExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) { $nodeExecutable = (Get-Command node -ErrorAction Stop).Source }
if ((& $nodeExecutable -p 'process.versions.node.split(".")[0]') -ne '24') { throw '需要Node.js 24' }
$cliRoot = Join-Path $projectRoot '.local-data/tooling/cloudbase-cli/node_modules/@cloudbase/cli'
$cliPackage = Get-Content -LiteralPath (Join-Path $cliRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($cliPackage.name -ne '@cloudbase/cli' -or $cliPackage.version -ne '3.8.7') { throw '需要已核验的官方CloudBase CLI 3.8.7，见操作手册' }
$cliEntry = Join-Path $cliRoot 'bin/tcb'
$env:TCB_NO_BROWSER = 'true'

function Invoke-CloudJson([string[]]$CloudArguments, [switch]$AllowApiError) {
  $cloudOutput = & $nodeExecutable $cliEntry @CloudArguments
  $cloudExit = $LASTEXITCODE
  $cloudText = $cloudOutput -join "`n"
  # Generic API commands may prepend an informational line even with --json.
  $jsonStart = $cloudText.IndexOf('{')
  if ($jsonStart -lt 0) { throw 'CloudBase没有返回可识别的JSON；停止后续操作' }
  try { $cloudResult = $cloudText.Substring($jsonStart) | ConvertFrom-Json } catch { throw 'CloudBase返回格式异常；停止后续操作' }
  if ($cloudResult.error) {
    if ($AllowApiError) { return $cloudResult }
    throw "CloudBase命令失败（$($cloudResult.error.code)）；停止后续操作"
  }
  if ($cloudExit -ne 0) {
    # Do not reproduce request bodies, tokens, or driver details in script errors.
    throw "CloudBase命令失败，退出码$cloudExit；停止后续操作"
  }
  return $cloudResult
}

Push-Location -LiteralPath $projectRoot
try {
  if ($Task -eq 'Login') {
    & $nodeExecutable $cliEntry login --flow device
    if ($LASTEXITCODE -ne 0) { throw 'CloudBase登录未完成' }
    return
  }
  $environmentResponse = Invoke-CloudJson -CloudArguments @('env','list','--region',$targetRegion,'--json')
  $target = @($environmentResponse.data | Where-Object { $_.EnvId -eq $targetEnv })
  if ($target.Count -ne 1) { throw '未找到唯一目标环境；停止操作' }
  if ($target[0].PackageId -ne 'baas_trial' -or $target[0].EnableOverrun -ne $false -or $target[0].IsAutoRenew -ne $false -or $target[0].Status -ne 'NORMAL') {
    throw '环境不再满足已核验的免费/按量关闭/自动续费关闭条件；停止操作'
  }
  if ($Task -in @('Plan','Apply')) {
    & $nodeExecutable --import tsx (Join-Path $projectRoot 'scripts/build-cloudbase-migrations.ts') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '原始迁移与已落地CloudBase文件不一致，停止规划/提交；变更需新版本' }
  }
  switch ($Task) {
    'Capabilities' {
      $body = @{ DBInstanceId = 'postgres-l3nqdxta' } | ConvertTo-Json -Compress
      $checks = [ordered]@{}
      foreach ($action in @('DescribeDBInstanceAttribute','DescribeDBInstanceSSLConfig','DescribeAccounts','DescribeBackupPlans')) {
        $api = Invoke-CloudJson -CloudArguments @('api','postgres',$action,'--api-version','2017-03-12','--region',$targetRegion,'--body',$body,'--json') -AllowApiError
        if ($api.error) {
          # Access denied is unknown capability, not a negative SSL/backup result.
          $checks[$action] = [ordered]@{ status = 'unknown'; errorCode = $api.error.code; requestId = $api.error.requestId }
          continue
        }
        $details = [ordered]@{ status = 'queried'; requestId = $api.data.RequestId }
        switch ($action) {
          'DescribeDBInstanceAttribute' {
            $instance = $api.data.DBInstance
            if ($instance.DBInstanceId -ne 'postgres-l3nqdxta' -or $instance.Region -ne $targetRegion) { throw '实例目标不匹配' }
            # Do not publish internal IPs, tenant/account IDs, or connection secrets.
            $details.instanceStatus = $instance.DBInstanceStatus
            $details.tenantType = $instance.DBTenantType
            $details.networks = @($instance.DBInstanceNetInfo | ForEach-Object {
              [ordered]@{ type = $_.NetType; protocol = $_.ProtocolType; status = $_.Status; hasAddress = [bool]$_.Address; hasIp = [bool]$_.Ip; hasPort = $_.Port -gt 0 }
            })
          }
          'DescribeDBInstanceSSLConfig' {
            $details.sslEnabled = $api.data.SSLEnabled
            $details.caAvailable = [bool]($api.data.CAUrl -or $api.data.CACert)
            $details.certificateAddressAvailable = [bool]$api.data.ConnectAddress
          }
          'DescribeAccounts' { $details.accountCount = @($api.data.Details | Where-Object { $null -ne $_ }).Count }
          'DescribeBackupPlans' {
            $details.plans = @($api.data.Plans | Select-Object PlanType,BackupMethod,BackupPeriod,BaseBackupRetentionPeriod,LogBackupRetentionPeriod)
          }
        }
        $checks[$action] = $details
      }
      [ordered]@{ environmentId = $targetEnv; region = $targetRegion; checkedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        readOnly = $true; releaseReady = $false; checks = $checks } | ConvertTo-Json -Depth 12
    }
    'Inspect' {
      $inspectionSql = Get-Content -LiteralPath (Join-Path $projectRoot 'deploy/db/cloudbase-verify.sql') -Raw -Encoding UTF8
      $response = Invoke-CloudJson -CloudArguments @('db','execute','-e',$targetEnv,'--region',$targetRegion,'--role','cloudbase_postgres','--sql',$inspectionSql,'--json')
      $values = @($response.data.Rows[0] | ConvertFrom-Json)
      $result = $values[0] | ConvertFrom-Json
      if ($result.database -ne 'postgres-l3nqdxta' -or $result.migration_role -ne 'cloudbase_postgres_postgres_l3nqdxta') { throw '数据库目标不匹配' }
      if ($result.project_table_count -ne 26 -or $result.tables_without_rls -ne 0 -or $result.client_table_access.Count -ne 0 -or $result.client_sequence_access.Count -ne 0 -or $result.client_public_defaults.Count -ne 0) {
        throw '项目结构/权限核验未通过，不能视为可发布'
      }
      $expectedMigrations = @('001-initial.sql','002-content-structure.sql','003-vector-structure.sql')
      if ($result.migrations.Count -ne $expectedMigrations.Count -or -not $result.vector.version -or $result.vector.schema -ne 'extensions') { throw '迁移账本/vector核验未通过' }
      for ($migrationIndex = 0; $migrationIndex -lt $expectedMigrations.Count; $migrationIndex++) {
        $migrationName = $expectedMigrations[$migrationIndex]
        $migrationSource = (Get-Content -LiteralPath (Join-Path $projectRoot "server/migrations/$migrationName") -Raw -Encoding UTF8).Replace("`r`n","`n")
        $migrationHasher = [Security.Cryptography.SHA256]::Create()
        try { $migrationHash = [BitConverter]::ToString($migrationHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($migrationSource))).Replace('-','').ToLowerInvariant() }
        finally { $migrationHasher.Dispose() }
        $remoteMigration = @($result.migrations | Where-Object { $_.version -eq ($migrationIndex+1) })
        if ($remoteMigration.Count -ne 1 -or $remoteMigration[0].filename -ne $migrationName -or $remoteMigration[0].checksum -ne $migrationHash) { throw "迁移$($migrationIndex+1)的源文件/checksum不一致" }
      }
      [ordered]@{
        environmentId = $targetEnv; region = $targetRegion; verifiedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        packageId = $target[0].PackageId; expireTime = $target[0].ExpireTime
        enableOverrun = $target[0].EnableOverrun; autoRenew = $target[0].IsAutoRenew
        requestId = $response.data.RequestId; releaseReady = $false; result = $result
      } | ConvertTo-Json -Depth 14
    }
    'Plan' {
      Invoke-CloudJson -CloudArguments @('db','pg','migration','up','-e',$targetEnv,'--region',$targetRegion,'--dry-run','--json') | ConvertTo-Json -Depth 12
    }
    'Apply' {
      # This command applies reviewed database migrations only; it never deploys a cloud service.
      Invoke-CloudJson -CloudArguments @('db','pg','migration','up','-e',$targetEnv,'--region',$targetRegion,'--json') | ConvertTo-Json -Depth 12
    }
    'History' {
      Invoke-CloudJson -CloudArguments @('db','pg','migration','list','-e',$targetEnv,'--region',$targetRegion,'--remote-only','--json') | ConvertTo-Json -Depth 12
    }
  }
} finally { Pop-Location }
