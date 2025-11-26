# Test WhatsApp Webhook on Render

$url = "https://bizta-api-1.onrender.com/api/v1/webhooks/whatsapp"
$secret = "46700f12a53ac58ca4ee146c9e18b39b"

$payload = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            id = "WHATSAPP_BUSINESS_ACCOUNT_ID"
            changes = @(
                @{
                    field = "messages"
                    value = @{
                        messaging_product = "whatsapp"
                        metadata = @{
                            display_phone_number = "16505551111"
                            phone_number_id = "845879995282173"
                        }
                        contacts = @(
                            @{
                                profile = @{
                                    name = "Test User"
                                }
                                wa_id = "16315551181"
                            }
                        )
                        messages = @(
                            @{
                                from = "16315551181"
                                id = "wamid.test123"
                                timestamp = "1732604400"
                                type = "text"
                                text = @{
                                    body = "Hello Bizta! Can you help me?"
                                }
                            }
                        )
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

# Calculate HMAC signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
$signature = "sha256=" + [BitConverter]::ToString($hash).Replace("-", "").ToLower()

Write-Host "Sending webhook to: $url" -ForegroundColor Cyan
Write-Host "Signature: $signature" -ForegroundColor Yellow
Write-Host ""

# Send request
try {
    $response = Invoke-WebRequest -Uri $url -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "X-Hub-Signature-256" = $signature
        } `
        -Body $payload `
        -UseBasicParsing

    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
    Write-Host ""
    Write-Host "Check Render logs for:" -ForegroundColor Cyan
    Write-Host "  - 🤖 Agent received event" -ForegroundColor White
    Write-Host "  - 💬 Conversation created" -ForegroundColor White
    Write-Host "  - 📥 Inbound message stored" -ForegroundColor White
    Write-Host "  - 🧠 LLM reply generated" -ForegroundColor White
    Write-Host "  - 📤 WhatsApp reply sent" -ForegroundColor White
    Write-Host "  - ✅ AgentAction created" -ForegroundColor White
}
catch {
    Write-Host "❌ Error!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
}
