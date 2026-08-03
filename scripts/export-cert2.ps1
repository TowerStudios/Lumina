$cert = Get-ChildItem -Path 'Cert:\CurrentUser\My\BDF2BBC5794291FF2455DF19EAF223C63D946898'
$certPath = 'G:\Lumina-main\resources\cert'

# 导出 PFX（含私钥）- 使用 Export-PfxCertificate cmdlet
try {
    $pwd = ConvertTo-SecureString -String 'lumina123' -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath "$certPath\cert.pfx" -Password $pwd -Force
    Write-Host "PFX exported"
} catch {
    Write-Host "PFX export failed: $_"
}

# 导出私钥 PEM
try {
    $key = $cert.PrivateKey
    if ($key) {
        $rsa = [System.Security.Cryptography.RSA]::Create()
        $rsa.ImportParameters($key.ExportParameters($true))
        $keyPem = $rsa.ExportRSAPrivateKeyPem()
        [System.IO.File]::WriteAllText("$certPath\key.pem", $keyPem)
        Write-Host "Private key exported"
    } else {
        Write-Host "PrivateKey is null, trying alternative..."
        # 尝试使用 RSACertificateExtensions
        $rsaKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
        if ($rsaKey) {
            $keyPem = $rsaKey.ExportRSAPrivateKeyPem()
            [System.IO.File]::WriteAllText("$certPath\key.pem", $keyPem)
            Write-Host "Private key exported (via RSACertificateExtensions)"
        } else {
            Write-Host "Cannot get private key"
        }
    }
} catch {
    Write-Host "Private key export failed: $_"
}

# 将证书添加到受信任的根证书存储
try {
    $sourceCert = Get-ChildItem -Path 'Cert:\CurrentUser\My\BDF2BBC5794291FF2455DF19EAF223C63D946898'
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($sourceCert)
    $store.Close()
    Write-Host "Certificate added to LocalMachine Root store"
} catch {
    Write-Host "Cannot add to LocalMachine Root store: $_"
    # 尝试 CurrentUser Root
    try {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
        $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $store.Add($sourceCert)
        $store.Close()
        Write-Host "Certificate added to CurrentUser Root store"
    } catch {
        Write-Host "Cannot add to CurrentUser Root store: $_"
    }
}
