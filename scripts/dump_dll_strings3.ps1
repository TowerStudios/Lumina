$bytes = [System.IO.File]::ReadAllBytes('g:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
# 搜索所有可能的进程名和检查相关字符串
$matches = [regex]::Matches($text, '[\x20-\x7E]{5,}') | ForEach-Object { $_.Value }
$filtered = $matches | Where-Object { 
  $_ -match '\.exe$|\.exe"|process|module|GetModule|verify|check|protect' 
} | Select-Object -Unique -First 60
$filtered | Sort-Object
