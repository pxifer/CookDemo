param(
  [ValidateSet('Prepare','Download','Start')][string]$Task = 'Start',
  [ValidateSet('qwen','bge')][string]$Model = 'qwen',
  [ValidateRange(1024,65535)][int]$Port = 15199,
  [ValidateRange(1,12)][int]$Threads = 6,
  [ValidateRange(32,32768)][int]$MaxTokens = 8192
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvRoot = Join-Path $projectRoot '.local-data/rag/venv'
$pythonExecutable = Join-Path $venvRoot 'Scripts/python.exe'
Push-Location -LiteralPath $projectRoot
try {
  if ($Task -eq 'Prepare') {
    if (!(Test-Path -LiteralPath $pythonExecutable)) {
      $basePython = Join-Path $env:USERPROFILE 'AppData/Local/Programs/Python/Python311/python.exe'
      if (!(Test-Path -LiteralPath $basePython)) { throw 'Python 3.11 is required; install it before preparing the isolated RAG runtime.' }
      & $basePython -m venv $venvRoot
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $pythonExecutable -m pip install 'torch==2.7.1+cpu' --index-url https://download.pytorch.org/whl/cpu --disable-pip-version-check --no-compile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $requirements = if (Test-Path -LiteralPath 'backend/rag-runtime/requirements.lock.txt') { 'backend/rag-runtime/requirements.lock.txt' } else { 'backend/rag-runtime/requirements.txt' }
    & $pythonExecutable -m pip install -r $requirements --disable-pip-version-check --no-compile
  } else {
    if (!(Test-Path -LiteralPath $pythonExecutable)) { throw 'Run scripts/rag-runtime.ps1 -Task Prepare first.' }
    $runtimeTask = if ($Task -eq 'Download') { 'download' } else { 'serve' }
    & $pythonExecutable -B backend/rag-runtime/runtime.py $runtimeTask --model $Model --port $Port --threads $Threads --max-tokens $MaxTokens
  }
  $runtimeExit = $LASTEXITCODE
} finally { Pop-Location }
exit $runtimeExit
