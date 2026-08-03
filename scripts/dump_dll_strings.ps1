$bytes = [System.IO.File]::ReadAllBytes('g:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll')
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$matches = [regex]::Matches($text, '[\x20-\x7E]{8,}') | ForEach-Object { $_.Value }
$filtered = $matches | Where-Object { $_ -match 'InitProtection|VerifyUser|weflow|token|license|auth|sign|process|exe|welive|WeFlow|Lumina|appid|app_id|product' } | Select-Object -Unique
$filtered | Sort-Object
