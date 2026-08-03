$bytes = [System.IO.File]::ReadAllBytes('G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$sb = New-Object System.Text.StringBuilder
$results = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $bytes.Length; $i++) {
  $b = $bytes[$i]
  if ($b -ge 32 -and $b -lt 127) {
    [void]$sb.Append([char]$b)
  } else {
    if ($sb.Length -ge 4) { $results.Add($sb.ToString()) }
    [void]$sb.Clear()
  }
}
$unique = $results | Select-Object -Unique | Sort-Object
Write-Host "=== skip/offline/disable/bypass/no_network/noneed ==="
$unique | Where-Object { $_ -match '(?i)skip|offline|disable|bypass|no_network|noneed|no-check|nocheck|skipcheck|skip_check|local_only|localonly' }
Write-Host ""
Write-Host "=== http/network/timeout ==="
$unique | Where-Object { $_ -match '(?i)http|network|timeout|curl|WinHttp|WinInet|InternetOpen' } | Select-Object -First 30
Write-Host ""
Write-Host "=== error/fail/invalid ==="
$unique | Where-Object { $_ -match '(?i)^error|^fail|^invalid|^unknown' } | Select-Object -First 30
Write-Host ""
Write-Host "=== SNAPSHOT/snapshot ==="
$unique | Where-Object { $_ -match '(?i)snapshot' }
