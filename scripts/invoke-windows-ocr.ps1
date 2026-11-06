param([switch]$Probe, [string]$InputManifest, [string]$Output)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1')
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Management\Microsoft.PowerShell.Management.psd1')
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await-OcrOperation($Operation, [Type]$ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(60000)) { $Operation.Cancel(); throw 'OCR_OPERATION_TIMEOUT' }
    return ,$task.Result
}
function Get-OcrIdentity {
    $dll = Get-Item -LiteralPath (Join-Path $env:windir 'System32\Windows.Media.Ocr.dll')
    $models = @()
    foreach ($language in @('en-us', 'zh-cn')) {
        $root = Join-Path $env:windir ('OCR\' + $language)
        foreach ($file in (Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName)) {
            $models += [ordered]@{file=($language + '/' + $file.FullName.Substring($root.Length + 1).Replace('\','/')); sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
        }
    }
    $value = [ordered]@{
        provider='windows.media.ocr'; osBuild=[Environment]::OSVersion.Version.ToString()
        engineFileVersion=$dll.VersionInfo.FileVersion; engineSha256=(Get-FileHash -LiteralPath $dll.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        languages=@([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object {$_.LanguageTag} | Sort-Object)
        modelFiles=$models; maxImageDimension=[Windows.Media.Ocr.OcrEngine]::MaxImageDimension
        confidenceAvailable=$false
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 15 -Compress))
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() }
    $value.identityHash = $hash
    return $value
}
$identity = Get-OcrIdentity
if ($Probe) { $identity | ConvertTo-Json -Depth 15 -Compress; exit 0 }
if (-not $InputManifest -or -not $Output) { throw 'BATCH_AND_OUTPUT_REQUIRED' }
$batchFile = (Resolve-Path -LiteralPath $InputManifest).Path
$batchRoot = [IO.Path]::GetDirectoryName($batchFile) + [IO.Path]::DirectorySeparatorChar
$target = [IO.Path]::GetFullPath($Output)
if (-not $target.StartsWith($batchRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)) { throw 'OUTPUT_OUTSIDE_BATCH_OR_EXISTS' }
$batch = Get-Content -LiteralPath $batchFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($batch.schemaVersion -ne 1 -or $batch.expectedEngineHash -ne $identity.identityHash -or $batch.jobs.Count -gt 200) { throw 'OCR_ENGINE_OR_BATCH_MISMATCH' }
$results = @(); $issued = 0; $seen = @{}
$progress = Join-Path $batchRoot 'issued-calls.jsonl'
if (Test-Path -LiteralPath $progress) { throw 'BATCH_ALREADY_STARTED_NEW_DIRECTORY_REQUIRED' }
[IO.File]::WriteAllText($progress, '', (New-Object Text.UTF8Encoding($false)))
foreach ($job in $batch.jobs) {
    if ($job.id -notmatch '^[a-z0-9.-]+$' -or $seen.ContainsKey($job.id)) { throw 'INVALID_OR_DUPLICATE_JOB' }
    $seen[$job.id] = $true
    $filePath = [IO.Path]::GetFullPath((Join-Path $batchRoot $job.image))
    if (-not $filePath.StartsWith($batchRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($filePath) -ne '.png') { throw 'IMAGE_PATH_ESCAPE' }
    if ((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $job.imageHash) { throw 'IMAGE_HASH_MISMATCH' }
    $stream = $null; $bitmap = $null
    $stage = 'language'
    try {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language($job.language)))
        if ($null -eq $engine) { throw 'OCR_LANGUAGE_UNAVAILABLE' }
        $stage = 'stream'
        # Read only the hash-verified batch image; no brokered StorageFile capability needed.
        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $writer = New-Object Windows.Storage.Streams.DataWriter($stream)
        try {
            $writer.WriteBytes([IO.File]::ReadAllBytes($filePath))
            $null = Await-OcrOperation ($writer.StoreAsync()) ([UInt32])
            $null = $writer.DetachStream()
        } finally { $writer.Dispose() }
        $stream.Seek(0)
        $stage = 'decoder'
        $decoder = Await-OcrOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $stage = 'bitmap'
        $bitmap = Await-OcrOperation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        if ($bitmap.PixelWidth -gt $identity.maxImageDimension -or $bitmap.PixelHeight -gt $identity.maxImageDimension) { throw 'IMAGE_DIMENSION_EXCEEDED' }
        $stage = 'recognition'
        $issued++
        [IO.File]::AppendAllText($progress, (([ordered]@{call=$issued; id=$job.id; imageHash=$job.imageHash} | ConvertTo-Json -Compress) + "`n"), (New-Object Text.UTF8Encoding($false)))
        $value = Await-OcrOperation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $lines = @(); $lineIndex = 0
        foreach ($line in $value.Lines) {
            $words = @(); $wordIndex = 0
            foreach ($word in $line.Words) {
                $b = $word.BoundingRect
                $words += [ordered]@{id=('l' + $lineIndex + 'w' + $wordIndex); text=$word.Text; bboxPx=@($b.X,$b.Y,($b.X+$b.Width),($b.Y+$b.Height)); confidence=$null}
                $wordIndex++
            }
            $lines += [ordered]@{id=('l'+$lineIndex); text=$line.Text; words=$words}; $lineIndex++
        }
        $results += [ordered]@{id=$job.id; imageHash=$job.imageHash; language=$engine.RecognizerLanguage.LanguageTag; width=$bitmap.PixelWidth; height=$bitmap.PixelHeight; text=$value.Text; textAngle=$value.TextAngle; lines=$lines; confidence=$null; confidenceReason='not_exposed_by_windows_ocr_api'; state='recognized_requires_review'}
    } catch {
        $results += [ordered]@{id=$job.id; imageHash=$job.imageHash; state='failed'; reason=$_.Exception.GetType().Name; stage=$stage; diagnostic=$_.Exception.GetBaseException().Message}
    } finally {
        if ($null -ne $bitmap) { $bitmap.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}
if ((Get-OcrIdentity).identityHash -ne $identity.identityHash) { throw 'ENGINE_CHANGED_DURING_BATCH' }
$report = [ordered]@{schemaVersion=1; engine=$identity; issuedCalls=$issued; automaticRetries=0; results=$results}
$json = $report | ConvertTo-Json -Depth 20
[IO.File]::WriteAllText($target, $json, (New-Object Text.UTF8Encoding($false)))
if (@($results | Where-Object {$_.state -eq 'failed'}).Count -gt 0) { exit 2 }
