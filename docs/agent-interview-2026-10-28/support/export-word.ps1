$ErrorActionPreference='Stop'
$docsRoot=Split-Path -Parent $PSScriptRoot
$qaRoot=Join-Path $PSScriptRoot 'qa'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
$word=New-Object -ComObject Word.Application
$word.Visible=$false
$word.DisplayAlerts=0
try {
  foreach ($file in Get-ChildItem -LiteralPath $docsRoot -Filter '0*.docx' -File) {
    $doc=$null
    try {
      $doc=$word.Documents.Open($file.FullName,$false,$true,$false)
      $doc.Repaginate()
      $pdfPath=Join-Path $qaRoot ($file.BaseName+'.pdf')
      $doc.ExportAsFixedFormat($pdfPath,17)
      [pscustomobject]@{File=$file.Name;Pages=$doc.ComputeStatistics(2);Pdf=$pdfPath}|ConvertTo-Json -Compress
    } finally {
      if($null -ne $doc){$doc.Close(0);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc)}
    }
  }
} finally {
  $word.Quit(0)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
