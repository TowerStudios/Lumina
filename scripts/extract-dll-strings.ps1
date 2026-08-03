$bytes = [System.IO.File]::ReadAllBytes('G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$sb = New-Object System.Text.StringBuilder
$results = @()
foreach ($b in $bytes) {
  if ($b -ge 32 -and $b -lt 127) {
    [void]$sb.Append([char]$b)
  } else {
    if ($sb.Length -ge 6) { $results += $sb.ToString() }
    [void]$sb.Clear()
  }
}
$results | Where-Object { $_ -match 'weflow|wechatdataanalysis|electron|\.exe|VerifyUser|api\.weflow|token|license|auth|InitProtection|GetModuleFileName|CreateProcess' } | Select-Object -Unique
