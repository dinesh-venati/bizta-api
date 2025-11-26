# Task 5: Follow-Up Skill (Automatic WhatsApp Reminders) - COMPLETE ✅

## Overview
Implemented Bizta's first "ops brain" capability: automatic customer follow-ups. When Bizta replies to a customer on WhatsApp and auto-followup is enabled, the system schedules a reminder message X hours later. If the customer replies before that time, the follow-up is automatically cancelled.

## Implementation Summary

### 1. Database Schema (Prisma)

**New Model: FollowupTask**
```prisma
model FollowupTask {
  id              String          @id @default(cuid())
  customerPhone   String
  channel         FollowupChannel
  type            FollowupType
  status          FollowupStatus  @default(PENDING)
  scheduledAt     DateTime
  sentAt          DateTime?
  messageTemplate String          @db.Text
  metadata        Json?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  orgId          String
  organization   Organization @relation(...)
  conversationId String
  conversation   Conversation @relation(...)
}
```

**New Enums:**
- `FollowupChannel`: WHATSAPP, EMAIL, WEBCHAT
- `FollowupType`: CUSTOMER_REMINDER, OWNER_REMINDER
- `FollowupStatus`: PENDING, SENT, CANCELLED, FAILED

**Updated Settings Model:**
- Added `followupDelayHours` (default: 24)
- Added `followupMessageTemplate` (optional custom message)

**Migration:**
```bash
# Local
npx prisma migrate dev --name add_followup_tasks

# Production
npx prisma migrate deploy
```

### 2. FollowupSkill Module

**Files Created:**
- `src/modules/skills/followup/followup.service.ts`
- `src/modules/skills/followup/followup.module.ts`

**Key Method: `scheduleCustomerFollowup()`**
```typescript
{
  orgId: string;
  conversationId: string;
  customerPhone: string;
  channel: 'whatsapp';
  delayHours: number;
  messageTemplate?: string;
}
```

**Behavior:**
1. Checks for existing PENDING followup (prevents duplicates)
2. Loads org settings for default message template
3. Creates FollowupTask with scheduledAt = now + delayHours
4. Enqueues BullMQ job to run at scheduledAt
5. Uses task ID as job ID for idempotency

**Default Template:**
```
Hi, just checking in 🙂 let me know if you'd like to continue or have any questions.
```

### 3. BullMQ Queue & Processor

**Files Created:**
- `src/queues/followup-jobs.processor.ts`
- `src/queues/queues.module.ts`

**Queue Name:** `followup-jobs`

**Job Payload:**
```typescript
{
  followupTaskId: string;
  orgId: string;
}
```

**Processor Logic:**
1. ✅ Load FollowupTask by ID
2. ✅ Exit if status is not PENDING
3. ✅ Check if autoFollowup is still enabled (could be disabled after scheduling)
4. ✅ Check for customer replies since task creation:
   - If customer replied → Cancel followup (status: CANCELLED)
   - If no reply → Send reminder
5. ✅ Send WhatsApp message via MessagingService
6. ✅ Store outbound Message record
7. ✅ Create Event (SCHEDULED_FOLLOWUP)
8. ✅ Create AgentAction (type: FOLLOWUP_SENT)
9. ✅ Update FollowupTask (status: SENT, sentAt: now)
10. ❌ On error → Mark task as FAILED with error details

### 4. Agent Integration

**Modified:** `src/modules/agent/agent.service.ts`

**After successful AI reply:**
```typescript
// 7. Schedule followup reminder if enabled
if (settings.autoFollowup && settings.followupDelayHours > 0) {
  await this.followup.scheduleCustomerFollowup({
    orgId,
    conversationId,
    customerPhone,
    channel: 'whatsapp',
    delayHours: settings.followupDelayHours,
    messageTemplate: settings.followupMessageTemplate,
  });
}
```

**Prevents Duplicate Followups:**
- Only schedules if no PENDING followup exists for conversation
- Graceful error handling (logs error but doesn't fail event)

### 5. Module Wiring

**Updated Files:**
- `src/modules/agent/agent.module.ts` - Imported FollowupModule
- `src/app.module.ts` - Registered QueuesModule
- `src/queues/queues.module.ts` - Created to hold FollowupJobsProcessor

**Dependencies:**
- FollowupModule → PrismaModule, BullModule (followup-jobs queue)
- QueuesModule → PrismaModule, MessagingModule, MessagesModule, BullModule
- AgentModule → Added FollowupModule

### 6. MessagingService Update

**Modified:** `src/modules/skills/messaging/messaging.service.ts`

**Return Value Changed:**
```typescript
// Before
async sendWhatsAppText(params): Promise<void>

// After
async sendWhatsAppText(params): Promise<{ messageId: string }>
```

This allows the followup processor to store the WhatsApp message ID properly.

## Testing

### Test Plan

#### Scenario 1: Followup Sent (Customer Silent)

**Steps:**
1. Send WhatsApp message to Bizta: "Hello Bizta!"
2. Bizta replies with AI-generated message
3. Wait for followup delay (24 hours by default, or reduce for testing)
4. Do NOT reply to Bizta during this time

**Expected Results:**
- ✅ FollowupTask created with status: PENDING
- ✅ BullMQ job scheduled for 24 hours later
- ✅ After delay, followup message sent: "Hi, just checking in 🙂..."
- ✅ FollowupTask updated to status: SENT, sentAt populated
- ✅ Message stored with direction: OUTBOUND
- ✅ AgentAction created with type: FOLLOWUP_SENT
- ✅ Event created with type: SCHEDULED_FOLLOWUP

**Example Logs (Followup Sent):**
```
[AgentService] 📤 WhatsApp reply sent to 918310420529
[FollowupService] 📅 Scheduled followup abc123 for 918310420529 at 2025-11-27T08:17:00.000Z
[FollowupService] Enqueued followup job abc123 with delay 86400000ms

... 24 hours later ...

[FollowupJobsProcessor] ⏰ Processing followup job abc123 for org 590223f8...
[FollowupJobsProcessor] 📤 Sending followup reminder to 918310420529
[MessagingService] Sending WhatsApp text to 918310420529 (org: 590223f8...): Hi, just checking in 🙂...
[MessagingService] ✅ WhatsApp message sent successfully to 918310420529 (messageId: wamid.xyz...)
[FollowupJobsProcessor] ✅ Followup message sent and stored: def456
[FollowupJobsProcessor] ✅ Followup abc123 completed successfully
```

#### Scenario 2: Followup Cancelled (Customer Replied)

**Steps:**
1. Send WhatsApp message to Bizta: "Hello Bizta!"
2. Bizta replies with AI-generated message
3. **Before the delay expires**, send another message: "Thanks!"
4. Wait for scheduled followup time

**Expected Results:**
- ✅ FollowupTask created with status: PENDING
- ✅ BullMQ job scheduled for 24 hours later
- ✅ Customer reply triggers new MESSAGE_RECEIVED event
- ✅ When job runs, processor detects customer reply
- ✅ FollowupTask updated to status: CANCELLED
- ✅ NO followup message sent
- ✅ NO new Message or AgentAction created

**Example Logs (Followup Cancelled):**
```
[AgentService] 📤 WhatsApp reply sent to 918310420529
[FollowupService] 📅 Scheduled followup abc123 for 918310420529 at 2025-11-27T08:17:00.000Z

... Customer replies with "Thanks!" ...

[AgentService] 📨 Message from 918310420529: "Thanks!" (id: wamid.xyz...)
[AgentService] 📤 WhatsApp reply sent to 918310420529

... 24 hours later ...

[FollowupJobsProcessor] ⏰ Processing followup job abc123 for org 590223f8...
[FollowupJobsProcessor] 📩 Customer replied to conversation def789, cancelling followup abc123
```

### Quick Testing (Reduced Delay)

For faster testing, update Settings in database:
```sql
UPDATE settings 
SET followup_delay_hours = 1  -- 1 hour instead of 24
WHERE org_id = '590223f8-0484-485f-88ee-ec2235455533';
```

Or use Prisma Studio:
```bash
npx prisma studio
# Navigate to Settings → Edit → Set followupDelayHours to 1
```

### Database Verification

**Check FollowupTask records:**
```sql
SELECT id, status, scheduled_at, sent_at, customer_phone, conversation_id 
FROM followup_tasks 
ORDER BY created_at DESC;
```

**Check Messages for followup:**
```sql
SELECT id, direction, content, created_at 
FROM messages 
WHERE conversation_id = '<conversation-id>' 
ORDER BY created_at DESC;
```

**Check AgentActions:**
```sql
SELECT id, type, status, tool_name, created_at 
FROM agent_actions 
WHERE type = 'FOLLOWUP_SENT' 
ORDER BY created_at DESC;
```

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - For BullMQ
- `WHATSAPP_*` - For sending messages

### Organization Settings
Configure via Settings model or Prisma Studio:
- `autoFollowup` (boolean) - Enable/disable followups
- `followupDelayHours` (int) - Hours to wait before sending reminder (default: 24)
- `followupMessageTemplate` (string) - Custom message template (optional)

### Production Seeding
Updated `seed-production.ts` to include followup settings:
```typescript
autoFollowup: true,
followupDelayHours: 24,
followupMessageTemplate: "Hi! Just checking in 🙂 Let me know if you'd like to continue or have any questions.",
```

## Key Features

### Smart Cancellation
- ✅ Detects customer replies after followup scheduled
- ✅ Prevents spam by checking INBOUND messages
- ✅ Respects conversation context

### Idempotency
- ✅ Uses task ID as BullMQ job ID
- ✅ Prevents duplicate followups per conversation
- ✅ Safe to retry scheduling

### Flexible Timing
- ✅ Configurable delay per organization
- ✅ Uses BullMQ delayed jobs (precise scheduling)
- ✅ Survives server restarts (persisted in Redis)

### Audit Trail
- ✅ Every followup creates Event (SCHEDULED_FOLLOWUP)
- ✅ Every sent followup creates AgentAction (FOLLOWUP_SENT)
- ✅ Every followup creates Message (OUTBOUND)
- ✅ FollowupTask tracks full lifecycle (PENDING → SENT/CANCELLED/FAILED)

### Error Handling
- ✅ Failed followups marked as FAILED with error details
- ✅ Doesn't crash worker on error
- ✅ Logs all errors with context
- ✅ WhatsApp API errors captured and stored

## Architecture Notes

### Why BullMQ Delayed Jobs?
- Precise scheduling at scale
- Survives server restarts (Redis persistence)
- Built-in retry and error handling
- Easy to monitor and debug

### Why Check at Execution Time?
Could check earlier, but execution-time checks are more robust:
- Settings might change (autoFollowup disabled)
- Customer might reply just before scheduled time
- More flexible for future enhancements

### Why Separate FollowupTask Model?
- Clear audit trail
- Can query/report on followup effectiveness
- Supports multiple followup types (customer, owner)
- Enables followup analytics in future

### MVP Limitations (Future Enhancements)
- ❌ No conversation history context (sends same template regardless)
- ❌ No retry logic for failed followups
- ❌ No A/B testing of message templates
- ❌ No time-of-day awareness (might send at 3 AM)
- ❌ No escalation to human if customer still doesn't reply
- ❌ Single followup only (no multi-stage sequences)

## Production Deployment

### Migration Commands
```bash
# Local (already done)
npx prisma migrate dev --name add_followup_tasks

# Production (via DATABASE_URL)
npx prisma migrate deploy
```

### Update Production Settings
Run in production:
```bash
npx ts-node seed-production.ts
# Or manually update via SQL/Prisma Studio
```

### Verify Queue Registration
Check BullBoard or Redis:
```bash
redis-cli
> KEYS *followup-jobs*
```

## What's Next?

Task 5 is complete! The system now:
- ✅ Schedules automatic followups after AI replies
- ✅ Cancels followups if customer replies
- ✅ Sends reminders via WhatsApp Cloud API
- ✅ Creates full audit trail
- ✅ Respects org settings

**Future Tasks:**
- Multi-stage followup sequences
- Time-of-day awareness
- Conversation history in followup messages
- Followup analytics dashboard
- Owner reminders (escalation)

---

**Status**: ✅ All todos completed  
**Build**: ✅ No compilation errors  
**Migration**: ✅ Applied locally  
**Integration**: ✅ Wired into AgentService  
**Testing**: Ready to test with reduced delay (1 hour)
