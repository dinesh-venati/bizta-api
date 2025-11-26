# WhatsApp Webhook Testing Script
# Tests webhook verification and message receipt

$baseUrl = "http://localhost:3000/api/v1"
$verifyToken = "bizta_verify_123"
$webhookSecret = "46700f12a53ac58ca4ee146c9e18b39b"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "WhatsApp Webhook Integration Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Webhook Verification (GET)
Write-Host "Test 1: Webhook Verification" -ForegroundColor Yellow
Write-Host "GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=test123" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=test123" -Method GET
    
    if ($response.StatusCode -eq 200 -and $response.Content -eq "test123") {
        Write-Host "✅ Webhook verification successful" -ForegroundColor Green
        Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Unexpected response" -ForegroundColor Red
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        Write-Host "   Body: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Webhook Message Receipt (POST)
Write-Host "Test 2: Webhook Message Receipt" -ForegroundColor Yellow
Write-Host "POST /webhooks/whatsapp" -ForegroundColor Gray

$webhookPayload = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            id = "123456789"
            changes = @(
                @{
                    field = "messages"
                    value = @{
                        messaging_product = "whatsapp"
                        messages = @(
                            @{
                                from = "918310420529"
                                id = "wamid.test123"
                                timestamp = "1700000000"
                                type = "text"
                                text = @{
                                    body = "Hello from test script!"
                                }
                            }
                        )
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Payload:" -ForegroundColor Gray
Write-Host $webhookPayload -ForegroundColor DarkGray

# Generate signature
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($webhookSecret))
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($webhookPayload))
$signature = "sha256=" + [BitConverter]::ToString($hash).Replace("-", "").ToLower()

Write-Host ""
Write-Host "Signature: $signature" -ForegroundColor Gray

try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-Hub-Signature-256" = $signature
    }
    
    $response = Invoke-WebRequest -Uri "$baseUrl/webhooks/whatsapp" -Method POST -Body $webhookPayload -Headers $headers
    
    if ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) {
        Write-Host "✅ Webhook message received successfully" -ForegroundColor Green
        Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Unexpected response" -ForegroundColor Red
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        Write-Host "   Body: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Tests Complete" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check server logs for event creation" -ForegroundColor Gray
Write-Host "2. Check Redis queue for agent-events job" -ForegroundColor Gray
Write-Host "3. Check database for Event record" -ForegroundColor Gray
Write-Host "4. Verify agent stub was called" -ForegroundColor Gray
