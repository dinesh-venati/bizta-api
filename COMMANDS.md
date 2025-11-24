# Bizta - Quick Commands Reference

## Initial Setup (One Time)
```powershell
# Automated setup (recommended)
.\setup.ps1

# OR Manual setup
npm install
Copy-Item .env.example .env
# Edit .env with your configuration
npx prisma generate
npx prisma migrate dev --name init
```

## Development
```powershell
# Start dev server (hot reload)
npm run start:dev

# Start in debug mode
npm run start:debug

# Start production build
npm run build
npm run start:prod
```

## Database
```powershell
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name description_of_changes

# Apply migrations in production
npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Seed database
npm run prisma:seed
```

## Code Quality
```powershell
# Format code
npm run format

# Lint code
npm run lint

# Fix lint errors
npm run lint -- --fix
```

## Testing
```powershell
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

## Docker (Optional)
```powershell
# Start PostgreSQL
docker run -d `
  --name bizta-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=bizta_dev `
  -p 5432:5432 `
  postgres:15

# Start Redis
docker run -d `
  --name bizta-redis `
  -p 6379:6379 `
  redis:7-alpine

# Stop containers
docker stop bizta-postgres bizta-redis

# Start containers
docker start bizta-postgres bizta-redis

# Remove containers
docker rm bizta-postgres bizta-redis

# View logs
docker logs -f bizta-postgres
docker logs -f bizta-redis
```

## Useful Scripts
```powershell
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secret
-join ((33..126) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Check if port is in use
Get-NetTCPConnection -LocalPort 3000

# Kill process on port
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Test health endpoint
curl http://localhost:3000/api/v1/health

# Test health endpoint (PowerShell)
Invoke-RestMethod -Uri http://localhost:3000/api/v1/health
```

## Git Workflow
```powershell
# Initial commit
git init
git add .
git commit -m "Initial Bizta backend setup"

# Feature branch
git checkout -b feature/whatsapp-webhook
git add .
git commit -m "feat: implement WhatsApp webhook handling"
git push origin feature/whatsapp-webhook
```

## Environment Variables Quick Reference
```env
# Core
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bizta_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<64-char-hex-string>

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<your-token>
WHATSAPP_WEBHOOK_SECRET=<your-secret>

# OpenAI
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4-turbo-preview

# Frontend
FRONTEND_URL=http://localhost:3001
```

## Troubleshooting
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Clear Prisma generated files
Remove-Item -Recurse -Force node_modules/.prisma
Remove-Item -Recurse -Force node_modules/@prisma/client
npx prisma generate

# Check PostgreSQL connection
$env:DATABASE_URL = "postgresql://..."
npx prisma db push

# Check Redis connection
redis-cli ping
# Should return: PONG

# View all environment variables
Get-ChildItem Env:

# Load .env in PowerShell (for testing)
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

## Project Structure
```
bizta-backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── common/               # Shared code
│   │   ├── decorators/       # @CurrentUser, @Public
│   │   ├── prisma/           # Database service
│   │   ├── services/         # Encryption, etc.
│   │   └── types/            # TypeScript types
│   ├── modules/              # Feature modules
│   │   ├── auth/
│   │   ├── users/
│   │   ├── orgs/
│   │   ├── channels/
│   │   ├── conversations/
│   │   ├── messages/
│   │   ├── events/
│   │   ├── agent/
│   │   ├── skills/
│   │   ├── settings/
│   │   └── audit/
│   ├── app.module.ts
│   └── main.ts
├── .env                      # Your configuration (git ignored)
├── .env.example              # Template
├── package.json
├── tsconfig.json
└── README.md
```

## Next Steps After Setup

1. **Verify health endpoint**
   ```powershell
   npm run start:dev
   curl http://localhost:3000/api/v1/health
   ```

2. **Implement WhatsApp webhook**
   - Create webhook controller
   - Verify signatures
   - Normalize events

3. **Build agent orchestrator**
   - LLM tool-calling
   - Context loading
   - Skill routing

4. **Add skills**
   - Messaging skill
   - Follow-up skill
   - Summary skill

## Useful Links

- NestJS Docs: https://docs.nestjs.com
- Prisma Docs: https://www.prisma.io/docs
- BullMQ Docs: https://docs.bullmq.io
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp
- OpenAI API: https://platform.openai.com/docs

---

**Pro Tips:**
- Always scope by `orgId` in queries
- Never block webhooks - use queues
- Encrypt all API keys before storing
- Log all agent actions for audit
- Use idempotency for webhook processors
- Test with Prisma Studio during development
