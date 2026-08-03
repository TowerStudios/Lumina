$bytes = [System.IO.File]::ReadAllBytes('G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$sb = New-Object System.Text.StringBuilder
$results = @()
foreach ($b in $bytes) {
  if ($b -ge 32 -and $b -lt 127) {
    [void]$sb.Append([char]$b)
  } else {
    if ($sb.Length -ge 4) { $results += $sb.ToString() }
    [void]$sb.Clear()
  }
}
# 查找所有可能的环境变量名（全大写字母+下划线，长度>=6）
$results | Where-Object { $_ -match '^[A-Z][A-Z0-9_]{5,}$' } | Select-Object -Unique | Sort-Object
Write-Host "---"
# 查找 -1006 附近的字符串
$results | Where-Object { $_ -match '1006|1005|GetEnv|getenv|_putenv|weflow_read|SNAPSHOT' } | Select-Object -Unique | Sort-Object
Write-Host "---"
# 查找进程名校验
$results | Where-Object { $_ -match 'weflow|wechatdata|\.exe|process|Process' } | Select-Object -Unique | Sort-Object
