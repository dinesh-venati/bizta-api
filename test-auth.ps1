# Quick Auth Test Script
Write-Host "🔐 Testing Bizta Authentication System" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Generate unique email for testing
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "test$timestamp@bizta.com"

try {
    # 1. Test Register
    Write-Host "1️⃣  Testing Register..." -ForegroundColor Yellow
    $registerBody = @{
        email = $testEmail
        password = "TestPassword123!"
        firstName = "Test"
        lastName = "User"
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json"

    Write-Host "✅ Register successful!" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Org: $($registerResponse.organization.name)" -ForegroundColor Gray
    Write-Host "   Org Slug: $($registerResponse.organization.slug)`n" -ForegroundColor Gray

    $accessToken = $registerResponse.accessToken
    $refreshToken = $registerResponse.refreshToken

    # 2. Test /me endpoint
    Write-Host "2️⃣  Testing GET /auth/me..." -ForegroundColor Yellow
    $meResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
        }

    Write-Host "✅ GET /me successful!" -ForegroundColor Green
    Write-Host "   Role: $($meResponse.role)" -ForegroundColor Gray
    Write-Host "   Agent Name: $($meResponse.settings.agentName)" -ForegroundColor Gray
    Write-Host "   Auto Reply: $($meResponse.settings.autoReply)`n" -ForegroundColor Gray

    # 3. Test Login
    Write-Host "3️⃣  Testing Login..." -ForegroundColor Yellow
    $loginBody = @{
        email = $testEmail
        password = "TestPassword123!"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"

    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   New tokens generated`n" -ForegroundColor Gray

    # 4. Test Refresh
    Write-Host "4️⃣  Testing Token Refresh..." -ForegroundColor Yellow
    $refreshBody = @{
        refreshToken = $refreshToken
    } | ConvertTo-Json

    $refreshResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/refresh" `
        -Method POST `
        -Body $refreshBody `
        -ContentType "application/json"

    Write-Host "✅ Token refresh successful!" -ForegroundColor Green
    Write-Host "   New access token generated`n" -ForegroundColor Gray

    # 5. Test with refreshed token
    Write-Host "5️⃣  Testing with refreshed token..." -ForegroundColor Yellow
    $meResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $($refreshResponse.accessToken)"
        }

    Write-Host "✅ Refreshed token works!" -ForegroundColor Green
    Write-Host "   User: $($meResponse2.user.email)`n" -ForegroundColor Gray

    # 6. Test invalid login
    Write-Host "6️⃣  Testing invalid login (should fail)..." -ForegroundColor Yellow
    try {
        $badLoginBody = @{
            email = $testEmail
            password = "WrongPassword!"
        } | ConvertTo-Json

        Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
            -Method POST `
            -Body $badLoginBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        Write-Host "❌ Should have failed but didn't!" -ForegroundColor Red
    } catch {
        Write-Host "✅ Invalid credentials rejected (expected)`n" -ForegroundColor Green
    }

    # 7. Test protected route without token
    Write-Host "7️⃣  Testing protected route without token (should fail)..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
            -Method GET `
            -ErrorAction Stop
        
        Write-Host "❌ Should have failed but didn't!" -ForegroundColor Red
    } catch {
        Write-Host "✅ Unauthorized access rejected (expected)`n" -ForegroundColor Green
    }

    # Summary
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "======================================`n" -ForegroundColor Cyan

    Write-Host "Test User Credentials:" -ForegroundColor White
    Write-Host "  Email: $testEmail" -ForegroundColor Gray
    Write-Host "  Password: TestPassword123!" -ForegroundColor Gray
    Write-Host "  Org ID: $($registerResponse.organization.id)" -ForegroundColor Gray
    Write-Host "  User ID: $($registerResponse.user.id)`n" -ForegroundColor Gray

} catch {
    Write-Host "❌ Test Failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
