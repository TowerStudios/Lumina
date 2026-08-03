$ErrorActionPreference = 'Continue'
Write-Host "=== Testing WinHTTP to api.weflow.top ==="
try {
    $response = Invoke-WebRequest -Uri 'https://api.weflow.top/api/token' -Method POST -TimeoutSec 10 -UseBasicParsing -ContentType 'application/json' -Body '{}'
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode)"
    }
    if ($_.Exception.InnerException) {
        Write-Host "Inner: $($_.Exception.InnerException.Message)"
    }
}

Write-Host ""
Write-Host "=== Testing WinHTTP to 127.0.0.1 directly ==="
try {
    $response2 = Invoke-WebRequest -Uri 'https://127.0.0.1/api/token' -Method POST -TimeoutSec 10 -UseBasicParsing -ContentType 'application/json' -Body '{}' -SkipCertificateCheck
    Write-Host "Status: $($response2.StatusCode)"
    Write-Host "Body: $($response2.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== DNS resolution check ==="
$resolved = [System.Net.Dns]::GetHostAddresses('api.weflow.top')
foreach ($addr in $resolved) {
    Write-Host "  api.weflow.top -> $addr"
}
