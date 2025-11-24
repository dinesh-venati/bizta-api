# Bizta Backend Setup Guide

## Step-by-Step Installation

### 1. Install Node.js Dependencies
Open PowerShell in the project directory and run:

```powershell
npm install
```

This will install all dependencies including:
- NestJS framework
- Prisma ORM
- BullMQ (Redis queues)
- JWT authentication
- OpenAI SDK
- Encryption libraries
- All TypeScript types

**Expected time**: 2-3 minutes

---

### 2. Setup Environment Variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Open `.env` in your editor and configure:

#### Required Configuration:

**Database (PostgreSQL)**
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/bizta_dev?schema=public
```

**Redis**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**JWT Secret** (generate a random key)
```powershell
# Generate in PowerShell:
-join ((33..126) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Encryption Key** (for API keys)
```powershell
# Generate in PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**OpenAI**
```env
OPENAI_API_KEY=sk-your-actual-openai-api-key
```

**WhatsApp Cloud API** (get from Meta Developer Portal)
```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-chosen-verify-token
WHATSAPP_WEBHOOK_SECRET=your-webhook-secret-from-meta
```

---

### 3. Start PostgreSQL & Redis

#### Option A: Using Docker (Recommended)

```powershell
# PostgreSQL
docker run -d `
  --name bizta-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=bizta_dev `
  -p 5432:5432 `
  postgres:15

# Redis
docker run -d `
  --name bizta-redis `
  -p 6379:6379 `
  redis:7-alpine
```

#### Option B: Local Installation
- Install PostgreSQL from https://www.postgresql.org/download/windows/
- Install Redis from https://github.com/microsoftarchive/redis/releases

---

### 4. Initialize Database

Generate Prisma Client:
```powershell
npx prisma generate
```

Create database tables:
```powershell
npx prisma migrate dev --name init
```

You should see output like:
```
✔ Generated Prisma Client
✔ Database migration applied successfully
```

(Optional) Open Prisma Studio to view database:
```powershell
npx prisma studio
```

---

### 5. Start Development Server

```powershell
npm run start:dev
```

You should see:
```
🚀 Bizta Backend running on: http://localhost:3000/api/v1
📊 Health check: http://localhost:3000/api/v1/health
✅ Database connected
```

---

### 6. Test the Health Endpoint

Open your browser or use curl:

```powershell
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-24T...",
  "service": "Bizta Backend",
  "database": "connected"
}
```

---

## Common Issues & Solutions

### Issue: Prisma generate fails
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### Issue: Port 3000 already in use
**Solution**: Change `PORT` in `.env` or kill the process:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

### Issue: Redis connection fails
**Solution**: Verify Redis is running:
```powershell
docker ps | Select-String redis
```

### Issue: TypeScript errors during start
**Solution**: Rebuild node_modules:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Project Status

✅ Project structure created
✅ Prisma schema defined (all models)
✅ NestJS modules scaffolded
✅ Health endpoint working
✅ Database connection configured
✅ Queue infrastructure ready
✅ Encryption service ready
✅ Multi-tenant architecture in place

### Ready for implementation:
- WhatsApp webhook handling
- Event queue processing
- Agent orchestrator (LLM tool-calling)
- Skills: messaging, followup, summary

---

## Development Workflow

1. **Make schema changes**: Edit `prisma/schema.prisma`
2. **Create migration**: `npx prisma migrate dev --name description`
3. **Generate client**: `npx prisma generate`
4. **Restart server**: Server auto-restarts with `npm run start:dev`

---

## Next Task: WhatsApp Webhook

After confirming this setup works, we'll implement:
1. WhatsApp webhook controller
2. Signature verification
3. Event normalization
4. Queue job creation
5. Agent processor
6. Messaging skill

The foundation is solid. Ready to build! 🚀
