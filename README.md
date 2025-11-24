# Bizta - AI Digital COO Backend

Enterprise-grade NestJS backend for Bizta, an AI employee that runs business operations across multiple channels.

## 🏗️ Architecture

### Tech Stack
- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: Redis + BullMQ
- **Auth**: JWT (Access + Refresh tokens)
- **LLM**: OpenAI (abstracted interface)
- **Security**: Multi-tenant, encrypted secrets, webhook verification

### Module Structure
```
src/
├── common/                 # Shared utilities
│   ├── decorators/        # Custom decorators
│   ├── prisma/            # Database service
│   ├── services/          # Encryption, etc.
│   └── types/             # Shared types
├── modules/
│   ├── auth/              # Authentication & JWT
│   ├── users/             # User management
│   ├── orgs/              # Multi-tenant organizations
│   ├── channels/          # WhatsApp, WebChat, etc.
│   ├── conversations/     # Conversation management
│   ├── messages/          # Message handling
│   ├── events/            # Normalized event system
│   ├── agent/             # AI orchestrator (LLM tool-calling)
│   ├── skills/            # Action modules
│   │   ├── messaging/     # Reply skill
│   │   ├── followup/      # Follow-up scheduling
│   │   ├── summary/       # Daily summaries
│   │   └── webmonitor/    # (Future) Website checks
│   ├── settings/          # Org settings
│   └── audit/             # Audit logs
├── app.module.ts
└── main.ts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### 1. Install Dependencies
```powershell
npm install
```

### 2. Environment Setup
```powershell
Copy-Item .env.example .env
```

Edit `.env` with your configuration:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `JWT_SECRET`: Generate a secure random key
- `ENCRYPTION_KEY`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `WHATSAPP_API_URL`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

### 3. Database Setup
```powershell
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Start Development Server
```powershell
npm run start:dev
```

Server will start at: `http://localhost:3000/api/v1`

Health check: `http://localhost:3000/api/v1/health`

## 📊 Data Models

### Core Entities
- **User**: System users with email/password
- **Organization**: Tenant isolation
- **Membership**: User ↔ Org with roles (OWNER, ADMIN, MEMBER, VIEWER)
- **Channel**: WhatsApp, WebChat, Email, Instagram
- **Conversation**: Customer conversations
- **Message**: Individual messages (inbound/outbound)
- **Event**: Normalized event system (MESSAGE_RECEIVED, etc.)
- **AgentAction**: AI decisions and tool executions
- **Settings**: Per-org configuration
- **SkillConfig**: Skill-specific settings
- **ApiKey**: Encrypted external API keys
- **WebhookLog**: Audit trail for webhooks

### Security Features
- Multi-tenant isolation (all queries scoped by `orgId`)
- Encrypted API keys using AES-256-GCM
- Password hashing with libsodium
- JWT access + refresh tokens
- Webhook signature verification
- Role-based access control

## 🔄 Event Flow

```
1. Webhook receives input → 2. Normalize to BiztaEvent → 3. Store in DB
                                                           ↓
4. Push to Redis Queue ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
                                                           ↓
5. Agent processor pulls event → 6. Load context + memory
                                                           ↓
7. Call LLM with tool schemas → 8. Execute tools (skills)
                                                           ↓
9. Save AgentAction → 10. Respond/Act
```

## 🛠️ Development Commands

```powershell
# Development
npm run start:dev        # Start with hot reload
npm run start:debug      # Start in debug mode

# Build
npm run build            # Production build
npm run start:prod       # Run production build

# Database
npx prisma generate      # Generate Prisma Client
npx prisma migrate dev   # Create & apply migration
npx prisma studio        # Open Prisma Studio GUI
npx prisma db seed       # Run seed script

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Testing
npm run test             # Run unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # E2E tests
```

## 🔐 Security Checklist

- [x] Multi-tenant data isolation
- [x] JWT authentication
- [x] Encrypted API keys
- [x] Password hashing (libsodium)
- [x] Webhook signature verification (ready)
- [x] Rate limiting (ThrottlerModule)
- [x] Input validation (class-validator)
- [x] CORS configuration
- [x] Audit logging (ready)

## 📁 Project Structure Details

### `/common`
- `prisma/`: Database service (global)
- `decorators/`: `@CurrentUser()`, `@CurrentOrg()`, `@Public()`, `@Roles()`
- `services/`: `EncryptionService` for API keys
- `types/`: Shared TypeScript interfaces

### `/modules`
Each module follows standard NestJS structure:
- `*.module.ts`: Module definition
- `*.controller.ts`: HTTP endpoints
- `*.service.ts`: Business logic
- `*.dto.ts`: Data transfer objects (Zod validation)
- `*.processor.ts`: BullMQ queue processors

## 🌐 API Endpoints (Planned)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/health

POST   /api/v1/webhooks/whatsapp
POST   /api/v1/webhooks/webchat

GET    /api/v1/conversations
GET    /api/v1/conversations/:id
GET    /api/v1/conversations/:id/messages

GET    /api/v1/agent/actions
GET    /api/v1/agent/actions/:id

GET    /api/v1/settings
PATCH  /api/v1/settings
```

## 🧪 Next Steps

After initial setup:
1. Implement WhatsApp webhook handling
2. Build event queue processing
3. Create agent orchestrator with LLM tool-calling
4. Implement messaging skill
5. Add follow-up skill with BullMQ scheduling
6. Build daily summary skill

## 📝 Notes

- All external API calls must be queued (never block webhooks)
- All database queries must filter by `orgId`
- All webhook responses must be < 5s
- Use idempotency keys for webhook processors
- Comprehensive logging for all agent actions

## 📞 Support

Built for production. MVP-first. Scalable foundation.
