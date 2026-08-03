$bytes = [System.IO.File]::ReadAllBytes('G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
Write-Host "File size: $($bytes.Length) bytes"
$sb = New-Object System.Text.StringBuilder
$results = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $bytes.Length; $i++) {
  $b = $bytes[$i]
  if ($b -ge 32 -and $b -lt 127) {
    [void]$sb.Append([char]$b)
  } else {
    if ($sb.Length -ge 6) { $results.Add($sb.ToString()) }
    [void]$sb.Clear()
  }
}
Write-Host "Total strings: $($results.Count)"
$unique = $results | Select-Object -Unique
Write-Host "Unique strings: $($unique.Count)"
Write-Host "=== weflow (case insensitive) ==="
$unique | Where-Object { $_ -match '(?i)weflow' }
Write-Host "=== wechatdataanalysis ==="
$unique | Where-Object { $_ -match 'wechatdataanalysis' }
Write-Host "=== .exe ==="
$unique | Where-Object { $_ -match '\.exe' }
Write-Host "=== token/license/api ==="
$unique | Where-Object { $_ -match '(?i)token|license|api\.weflow' }
