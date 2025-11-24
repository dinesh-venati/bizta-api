# Auth API Testing Guide

## Testing Authentication Endpoints

### 1. Register a New User

**Request:**
```powershell
$body = @{
    email = "john@example.com"
    password = "SecurePass123!"
    firstName = "John"
    lastName = "Doe"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "organization": {
    "id": "uuid",
    "name": "John's Organization",
    "slug": "johns-organization"
  }
}
```

### 2. Login

**Request:**
```powershell
$body = @{
    email = "john@example.com"
    password = "SecurePass123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "organization": {
    "id": "uuid",
    "name": "John's Organization",
    "slug": "johns-organization"
  }
}
```

### 3. Get Current User (Protected Route)

**Request:**
```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $token"
    }
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": "2025-11-24T..."
  },
  "organization": {
    "id": "uuid",
    "name": "John's Organization",
    "slug": "johns-organization",
    "isActive": true
  },
  "role": "OWNER",
  "settings": {
    "id": "uuid",
    "agentName": "Bizta",
    "businessName": "John's Organization",
    "autoReply": true,
    "autoFollowup": true,
    "dailySummaryEnabled": true,
    "dailySummaryTime": "09:00",
    "timezone": "UTC",
    "maxAutoRepliesPerDay": 100,
    "orgId": "uuid",
    "createdAt": "2025-11-24T...",
    "updatedAt": "2025-11-24T..."
  }
}
```

### 4. Refresh Access Token

**Request:**
```powershell
$body = @{
    refreshToken = "YOUR_REFRESH_TOKEN_HERE"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/refresh" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Error Responses

### Duplicate Email on Register
```json
{
  "statusCode": 409,
  "message": "User with this email already exists",
  "error": "Conflict"
}
```

### Invalid Credentials on Login
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### Invalid Token
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Missing Authorization Header
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Validation Error
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

---

## Complete Test Flow (PowerShell)

```powershell
# 1. Register
$registerBody = @{
    email = "test@bizta.com"
    password = "TestPassword123!"
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" `
    -Method POST `
    -Body $registerBody `
    -ContentType "application/json"

Write-Host "✅ Registered successfully"
Write-Host "User ID: $($registerResponse.user.id)"
Write-Host "Org ID: $($registerResponse.organization.id)"
Write-Host "Org Name: $($registerResponse.organization.name)"

# Save tokens
$accessToken = $registerResponse.accessToken
$refreshToken = $registerResponse.refreshToken

# 2. Get current user info
$meResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $accessToken"
    }

Write-Host "`n✅ Got current user info"
Write-Host "Role: $($meResponse.role)"
Write-Host "Agent Name: $($meResponse.settings.agentName)"

# 3. Refresh token
$refreshBody = @{
    refreshToken = $refreshToken
} | ConvertTo-Json

$refreshResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/refresh" `
    -Method POST `
    -Body $refreshBody `
    -ContentType "application/json"

Write-Host "`n✅ Refreshed access token"
$newAccessToken = $refreshResponse.accessToken

# 4. Test with new access token
$meResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $newAccessToken"
    }

Write-Host "✅ New token works - User: $($meResponse2.user.email)"

# 5. Login (should work with same credentials)
$loginBody = @{
    email = "test@bizta.com"
    password = "TestPassword123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method POST `
    -Body $loginBody `
    -ContentType "application/json"

Write-Host "`n✅ Login successful"
Write-Host "Access Token: $($loginResponse.accessToken.Substring(0, 50))..."

Write-Host "`n🎉 All auth tests passed!"
```

---

## JWT Payload Structure

The JWT access token contains:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "orgId": "org-uuid",
  "role": "OWNER",
  "iat": 1700000000,
  "exp": 1700000900
}
```

This payload is automatically extracted by the `JwtAuthGuard` and injected into:
- `request.user.userId` (from `sub`)
- `request.user.email`
- `request.user.orgId`
- `request.user.role`

You can access these in controllers using:
- `@CurrentUser()` - Full user object
- `@CurrentOrg()` - `{ orgId, role }`

---

## Multi-Tenant Scoping

**CRITICAL**: Every protected route automatically has access to the `orgId` from the JWT token.

**Never** accept `orgId` from request body or query params for data filtering.

**Always** use:
```typescript
@Get('data')
async getData(@CurrentUser() user: any) {
  // user.orgId is from JWT - trusted
  return this.service.findByOrg(user.orgId);
}
```

---

## Protected Routes

By default, **ALL routes are protected** by the global `JwtAuthGuard`.

To make a route public, use the `@Public()` decorator:
```typescript
@Public()
@Get('status')
getStatus() {
  return { status: 'ok' };
}
```

To require specific roles:
```typescript
@Roles('OWNER', 'ADMIN')
@Delete('organization')
deleteOrg() {
  // Only OWNER or ADMIN can access
}
```
