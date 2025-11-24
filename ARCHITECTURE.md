# Bizta Architecture Documentation

## System Overview

Bizta is an AI Digital COO that operates as an autonomous agent, not a chatbot. It ingests events from multiple channels, processes them through an AI orchestrator, and executes actions via specialized skills.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT CHANNELS                           │
├─────────────┬─────────────┬─────────────┬──────────────────────┤
│  WhatsApp   │  WebChat    │    Email    │   Instagram DMs      │
│  Cloud API  │   Widget    │  (Future)   │    (Future)          │
└──────┬──────┴──────┬──────┴──────┬──────┴───────┬──────────────┘
       │             │             │              │
       └─────────────┴─────────────┴──────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Webhook Controllers  │
         │  (Signature Verify)   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Event Normalizer    │
         │  → BiztaEvent Model   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   PostgreSQL + Redis  │
         │   Store Event + Job   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   BullMQ Processor    │
         │   (agent-events queue)│
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Agent Orchestrator   │
         │  1. Load Context      │
         │  2. Call LLM          │
         │  3. Parse Tool Calls  │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │    Skill Executor     │
         │  Route to Skills      │
         └───────────┬───────────┘
                     │
       ┌─────────────┼─────────────┬──────────────┐
       │             │             │              │
       ▼             ▼             ▼              ▼
  ┌────────┐   ┌────────┐   ┌─────────┐   ┌──────────┐
  │Messaging│   │Follow-up│   │Summary  │   │Web Check│
  │ Skill   │   │ Skill   │   │ Skill   │   │  (Later) │
  └────┬───┘   └────┬────┘   └────┬────┘   └─────┬────┘
       │            │             │              │
       └────────────┴─────────────┴──────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   AgentAction Log     │
         │   (Audit + Memory)    │
         └───────────────────────┘
```

## Data Flow: Message Received Example

### 1. Inbound Message (WhatsApp)
```
Customer: "Hi, do you have availability tomorrow?"
  ↓
WhatsApp Cloud API → POST /webhooks/whatsapp
  ↓
Webhook Controller:
  - Verify signature
  - Log webhook
  - Extract message data
```

### 2. Event Normalization
```typescript
{
  id: "evt_xxx",
  type: "MESSAGE_RECEIVED",
  orgId: "org_abc",
  channelId: "ch_whatsapp_1",
  conversationId: "conv_xyz",
  payload: {
    messageId: "wamid.xxx",
    from: "+1234567890",
    content: "Hi, do you have availability tomorrow?",
    timestamp: "2025-11-24T10:30:00Z"
  }
}
```

### 3. Store & Queue
```
→ Save Event to PostgreSQL (status: PENDING)
→ Save Message to PostgreSQL
→ Update Conversation.lastMessageAt
→ Push job to Redis queue "agent-events"
→ Return 200 OK (< 5s response time)
```

### 4. Agent Processing
```typescript
// Queue processor pulls job
const event = await getEvent(eventId);
const context = await buildContext({
  event,
  orgId: event.orgId,
  conversationId: event.conversationId,
  // Load: settings, recent messages, memory
});

// Call LLM with tool schemas
const llmResponse = await callLLM({
  systemPrompt: buildSystemPrompt(context),
  messages: context.recentMessages,
  tools: [
    { name: "reply", schema: {...} },
    { name: "schedule_followup", schema: {...} },
    { name: "escalate", schema: {...} }
  ]
});

// LLM returns tool call
{
  toolName: "reply",
  toolInput: {
    content: "Yes! We have slots available at 10 AM and 2 PM. Which works better for you?",
    conversationId: "conv_xyz"
  }
}
```

### 5. Execute Skill
```
Skill Router → MessagingSkill.reply()
  ↓
Call WhatsApp API to send message
  ↓
Save outbound Message to DB
  ↓
Save AgentAction record:
  - type: REPLY
  - toolName: reply
  - toolInput: {...}
  - toolOutput: { messageId: "wamid.yyy", status: "sent" }
  - llmTokens: 245
```

### 6. Complete
```
Event.status → COMPLETED
Customer receives reply
Audit trail created
```

## Multi-Tenancy Architecture

### Tenant Isolation
Every data access MUST be scoped by `orgId`:

```typescript
// ❌ WRONG - No tenant filter
const conversations = await prisma.conversation.findMany();

// ✅ CORRECT - Always filter by orgId
const conversations = await prisma.conversation.findMany({
  where: { orgId: currentUser.orgId }
});
```

### Membership Roles
- **OWNER**: Full access, billing, delete org
- **ADMIN**: Manage users, channels, settings
- **MEMBER**: View conversations, manual replies
- **VIEWER**: Read-only access

### Guards & Middleware
```typescript
@UseGuards(JwtAuthGuard, OrgGuard)
@Roles('ADMIN', 'OWNER')
@Get('conversations')
async getConversations(
  @CurrentUser() user: User,
  @CurrentOrg() org: Organization
) {
  // org is already verified and loaded
  return this.conversationsService.findAll(org.id);
}
```

## LLM Orchestrator Design

### System Prompt Structure
```
You are Bizta, the AI Digital COO for [Business Name].

CONTEXT:
- Business: [businessDescription]
- Hours: [businessHours]
- Timezone: [timezone]

CURRENT SITUATION:
- Customer: [customerName]
- Last 10 messages: [messageHistory]
- Time: [currentTime]

TOOLS AVAILABLE:
1. reply - Send a message to the customer
2. schedule_followup - Set a reminder for later
3. escalate - Flag for human review
4. create_summary - Generate a summary

RULES:
- Be professional and helpful
- Use business context to answer
- If outside business hours, mention response time
- Escalate complex issues
- Keep responses under 500 chars

DECIDE: What action should we take?
```

### Tool Schema Example
```typescript
const tools = [
  {
    name: "reply",
    description: "Send a message to the customer",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The message to send"
        },
        conversationId: {
          type: "string",
          description: "The conversation ID"
        }
      },
      required: ["content", "conversationId"]
    }
  }
];
```

### LLM Interface (Abstracted)
```typescript
interface LLMProvider {
  call(params: {
    messages: Message[];
    tools: Tool[];
    model: string;
    temperature: number;
  }): Promise<LLMResponse>;
}

// Implementations:
// - OpenAIProvider
// - AnthropicProvider
// - LocalLLMProvider
```

## Queue Architecture

### Queues
1. **agent-events**: Main event processing
2. **messaging-outbound**: Send messages (rate limiting)
3. **followup-scheduler**: Scheduled follow-ups
4. **daily-summary**: Daily report generation

### Queue Configuration
```typescript
@Processor('agent-events')
export class AgentProcessor {
  @Process()
  async process(job: Job<BiztaEvent>) {
    // Idempotency check
    const event = await this.getEvent(job.data.id);
    if (event.status !== 'PENDING') {
      return; // Already processed
    }

    try {
      await this.agentOrchestrator.process(event);
    } catch (error) {
      // Retry logic via BullMQ
      throw error;
    }
  }
}
```

### Job Options
```typescript
await this.eventQueue.add('process-event', event, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: false,
});
```

## Security Model

### Authentication Flow
```
1. User → POST /auth/login { email, password }
2. Verify credentials (libsodium hash)
3. Generate tokens:
   - accessToken (15min, JWT)
   - refreshToken (7 days, JWT)
4. Return both tokens
5. Client stores in httpOnly cookies or localStorage

Subsequent requests:
  Authorization: Bearer <accessToken>

Token refresh:
  POST /auth/refresh { refreshToken }
  → New accessToken
```

### API Key Encryption
```typescript
// Storing
const encrypted = encryptionService.encrypt(whatsappApiKey);
await prisma.apiKey.create({
  data: {
    type: 'WHATSAPP',
    encryptedValue: encrypted,
    orgId: org.id
  }
});

// Retrieving
const apiKey = await prisma.apiKey.findFirst({
  where: { orgId, type: 'WHATSAPP', isActive: true }
});
const decrypted = encryptionService.decrypt(apiKey.encryptedValue);
```

### Webhook Verification
```typescript
// WhatsApp signature verification
const signature = req.headers['x-hub-signature-256'];
const payload = JSON.stringify(req.body);
const hash = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

if (signature !== `sha256=${hash}`) {
  throw new UnauthorizedException('Invalid signature');
}
```

## Scaling Considerations

### Horizontal Scaling
- Stateless NestJS servers (no sessions)
- Shared PostgreSQL + Redis
- Load balancer distributes webhooks
- Multiple queue workers

### Database Optimization
- Indexes on: `orgId`, `conversationId`, `channelId`, `createdAt`
- Partitioning: Messages by month
- Read replicas for analytics

### Caching Strategy
- Redis cache for:
  - Active conversations
  - Settings per org
  - API keys (decrypted, TTL 5min)

### Rate Limiting
- Per-org API rate limits
- WhatsApp: 80 msgs/sec (tiered)
- Queue concurrency limits

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│            Load Balancer (Nginx)            │
└───────────────────┬─────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  NestJS App 1 │       │  NestJS App 2 │
│  (Web + API)  │       │  (Web + API)  │
└───────┬───────┘       └───────┬───────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  PostgreSQL   │       │     Redis     │
│   (Primary)   │       │  (Queues +    │
│               │       │    Cache)     │
└───────────────┘       └───────────────┘
```

## Monitoring & Observability

### Metrics to Track
- Event processing time
- LLM response time & tokens
- Queue depth & lag
- Message delivery rate
- Error rate by skill
- API key usage per org

### Logging
```typescript
logger.log({
  level: 'info',
  orgId: org.id,
  eventType: event.type,
  agentAction: action.type,
  llmTokens: response.tokens,
  executionTime: Date.now() - start,
  messageId: message.id
});
```

### Health Checks
- `/health`: DB connection + Redis
- `/health/db`: Database query test
- `/health/redis`: Redis ping
- `/health/queue`: Queue status

---

**Architecture principles:**
1. **Event-driven**: Everything is an event
2. **Queue-first**: Never block webhooks
3. **Tenant-isolated**: Zero data leakage
4. **Tool-based**: LLM calls tools, not code
5. **Auditable**: Every action logged
6. **Scalable**: Stateless + horizontal

This architecture supports:
- ✅ Multiple channels
- ✅ High throughput (1000+ msgs/min)
- ✅ Multi-tenant
- ✅ Real-time responses
- ✅ Scheduled actions
- ✅ Audit trail
- ✅ Easy skill additions
