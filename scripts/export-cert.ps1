$cert = Get-ChildItem -Path 'Cert:\CurrentUser\My\BDF2BBC5794291FF2455DF19EAF223C63D946898'
$certPath = 'G:\Lumina-main\resources\cert'
if (!(Test-Path $certPath)) { New-Item -ItemType Directory -Path $certPath -Force }

# 导出 PFX（含私钥）
$certBytes = $cert.Export('Pfx', 'lumina123')
[System.IO.File]::WriteAllBytes("$certPath\cert.pfx", $certBytes)
Write-Host "PFX exported to $certPath\cert.pfx"

# 导出 PEM 证书
$pem = New-Object System.Text.StringBuilder
$pem.AppendLine('-----BEGIN CERTIFICATE-----')
$pem.AppendLine([Convert]::ToBase64String($cert.RawData, [Base64FormattingOptions]::InsertLineBreaks))
$pem.AppendLine('-----END CERTIFICATE-----')
[System.IO.File]::WriteAllText("$certPath\cert.pem", $pem.ToString())
Write-Host "PEM exported to $certPath\cert.pem"

# 将证书添加到受信任的根证书存储
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine')
$store.Open('ReadWrite')
$store.Add($cert)
$store.Close()
Write-Host "Certificate added to trusted root store"
