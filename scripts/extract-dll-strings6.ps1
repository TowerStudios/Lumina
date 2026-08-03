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
Write-Host "=== IP 地址 ==="
$unique | Where-Object { $_ -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' }
Write-Host ""
Write-Host "=== 13.54 (AWS IP) ==="
$unique | Where-Object { $_ -match '13\.54|54\.62' }
Write-Host ""
Write-Host "=== getenv/GetEnvironment ==="
$unique | Where-Object { $_ -match '(?i)getenv|GetEnvironment|_putenv|_dupenv_s' }
Write-Host ""
Write-Host "=== RegOpen/RegQuery (注册表) ==="
$unique | Where-Object { $_ -match '(?i)RegOpen|RegQuery|RegClose|HKEY|Software\\\\' }
Write-Host ""
Write-Host "=== file/path/read ==="
$unique | Where-Object { $_ -match '(?i)^file|^path|^read|^open.*file|CreateFile|ReadFile' } | Select-Object -First 20
Write-Host ""
Write-Host "=== token/json/success ==="
$unique | Where-Object { $_ -match '(?i)token|json|success|auth' } | Select-Object -First 20
