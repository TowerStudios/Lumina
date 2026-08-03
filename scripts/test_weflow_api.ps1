try {
  $response = Invoke-WebRequest -Uri 'https://api.weflow.top/api/token' -Method GET -TimeoutSec 10 -UseBasicParsing
  Write-Host "Status: $($response.StatusCode)"
  $len = [Math]::Min(500, $response.Content.Length)
  Write-Host "Body: $($response.Content.Substring(0, $len))"
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}
