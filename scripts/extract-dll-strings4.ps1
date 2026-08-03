$bytes = [System.IO.File]::ReadAllBytes('G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
# 将整个文件转为 ASCII 字符串（null 分隔），搜索关键字节序列
$text = [System.Text.Encoding]::ASCII.GetString($bytes)

# 搜索 weflow_read_opt 周围的上下文
$pattern = 'weflow_read_opt'
$idx = $text.IndexOf($pattern)
Write-Host "=== weflow_read_opt 上下文 (位置 $idx) ==="
if ($idx -ge 0) {
  $start = [Math]::Max(0, $idx - 100)
  $len = [Math]::Min(300, $text.Length - $start)
  $context = $text.Substring($start, $len)
  # 将不可打印字符替换为 | 
  $clean = ($context.ToCharArray() | ForEach-Object { if ([int]$_ -ge 32 -and [int]$_ -lt 127) { $_ } else { '|' } }) -join ''
  Write-Host $clean
}

Write-Host ""
Write-Host "=== WEFLOW_SNAPSHOT_V1 上下文 ==="
$pattern2 = 'WEFLOW_SNAPSHOT_V1'
$idx2 = $text.IndexOf($pattern2)
if ($idx2 -ge 0) {
  $start = [Math]::Max(0, $idx2 - 100)
  $len = [Math]::Min(300, $text.Length - $start)
  $context = $text.Substring($start, $len)
  $clean = ($context.ToCharArray() | ForEach-Object { if ([int]$_ -ge 32 -and [int]$_ -lt 127) { $_ } else { '|' } }) -join ''
  Write-Host $clean
}

Write-Host ""
Write-Host "=== api/token 上下文 ==="
$pattern3 = 'api/token'
$idx3 = $text.IndexOf($pattern3)
if ($idx3 -ge 0) {
  $start = [Math]::Max(0, $idx3 - 200)
  $len = [Math]::Min(500, $text.Length - $start)
  $context = $text.Substring($start, $len)
  $clean = ($context.ToCharArray() | ForEach-Object { if ([int]$_ -ge 32 -and [int]$_ -lt 127) { $_ } else { '|' } }) -join ''
  Write-Host $clean
}
