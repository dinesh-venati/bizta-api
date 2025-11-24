# Bizta - Complete Setup Script for PowerShell
# Run this script from the project root directory

Write-Host "🚀 Bizta Backend Setup Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Install dependencies
Write-Host "📦 Step 1: Installing Node.js dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed`n" -ForegroundColor Green

# Step 2: Check for .env file
if (-Not (Test-Path ".env")) {
    Write-Host "📝 Step 2: Creating .env file..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  Please edit .env with your configuration before continuing!" -ForegroundColor Yellow
    Write-Host "   Required: DATABASE_URL, REDIS_HOST, JWT_SECRET, ENCRYPTION_KEY, OPENAI_API_KEY`n" -ForegroundColor Yellow
    
    Write-Host "Generate ENCRYPTION_KEY with:" -ForegroundColor Cyan
    Write-Host "  node -e `"console.log(require('crypto').randomBytes(32).toString('hex'))`"`n" -ForegroundColor White
    
    $continue = Read-Host "Press Enter when .env is configured (or Ctrl+C to exit)"
} else {
    Write-Host "✅ .env file found`n" -ForegroundColor Green
}

# Step 3: Generate Prisma Client
Write-Host "🗄️  Step 3: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated`n" -ForegroundColor Green

# Step 4: Run migrations
Write-Host "🔄 Step 4: Running database migrations..." -ForegroundColor Yellow
Write-Host "⚠️  Ensure PostgreSQL is running before continuing!" -ForegroundColor Yellow
$continue = Read-Host "Press Enter to run migrations (or Ctrl+C to exit)"

npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    Write-Host "   Make sure PostgreSQL is running and DATABASE_URL is correct" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Database migrations applied`n" -ForegroundColor Green

# Step 5: Success message
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Start the development server:" -ForegroundColor Cyan
Write-Host "  npm run start:dev`n" -ForegroundColor White

Write-Host "Health check will be available at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/api/v1/health`n" -ForegroundColor White

Write-Host "Optional: Open Prisma Studio" -ForegroundColor Cyan
Write-Host "  npx prisma studio`n" -ForegroundColor White

Write-Host "🎉 Ready to build Bizta!" -ForegroundColor Green
