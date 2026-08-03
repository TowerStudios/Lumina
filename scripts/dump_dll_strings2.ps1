$bytes = [System.IO.File]::ReadAllBytes('g:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
# 搜索更多关键字符串
$matches = [regex]::Matches($text, '[\x20-\x7E]{6,}') | ForEach-Object { $_.Value }
$filtered = $matches | Where-Object { 
  $_ -match 'weflow\.exe|wechatdata|process.*name|GetModuleFileName|CheckProcess|verify.*process|appid|product.*name|WEFLOW|weflow_read' 
} | Select-Object -Unique
$filtered | Sort-Object
Write-Host "---UTF16---"
$text16 = [System.Text.Encoding]::Unicode.GetString($bytes)
$matches16 = [regex]::Matches($text16, '[\x20-\x7E]{6,}') | ForEach-Object { $_.Value }
$filtered16 = $matches16 | Where-Object { 
  $_ -match 'weflow|wechatdata|process|appid|WEFLOW|Lumina' 
} | Select-Object -Unique
$filtered16 | Sort-Object
