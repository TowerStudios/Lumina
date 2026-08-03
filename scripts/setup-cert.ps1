$ErrorActionPreference = 'Stop'
$thumbprint = 'BDF2BBC5794291FF2455DF19EAF223C63D946898'
$certDir = 'G:\Lumina-main\scripts\cert'

if (!(Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir -Force | Out-Null }

# 1. Add cert to LocalMachine\Root (trusted by system services including DLL's WinHTTP)
Write-Host "=== Adding cert to LocalMachine\Root ==="
$cert = Get-ChildItem "Cert:\CurrentUser\My\$thumbprint"
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','LocalMachine')
$store.Open('ReadWrite')
$store.Add($cert)
$store.Close()
Write-Host "Cert added to LocalMachine\Root"

# 2. Export PFX (with private key) for the HTTPS server
Write-Host "=== Exporting PFX ==="
$pwd = ConvertTo-SecureString -String 'lumina123' -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$certDir\cert.pfx" -Password $pwd -Force
Write-Host "PFX exported to $certDir\cert.pfx"

# 3. Export public cert (.cer)
Write-Host "=== Exporting CER ==="
Export-Certificate -Cert $cert -FilePath "$certDir\cert.cer" -Force
Write-Host "CER exported to $certDir\cert.cer"

# 4. Verify cert is in Root store
Write-Host "=== Verifying Root store ==="
$rootCert = Get-ChildItem "Cert:\LocalMachine\Root\$thumbprint" -ErrorAction SilentlyContinue
if ($rootCert) {
    Write-Host "Cert found in LocalMachine\Root: $($rootCert.Subject)"
} else {
    Write-Host "WARNING: Cert NOT found in LocalMachine\Root"
}

Write-Host "=== Done ==="
