# Task 8 Testing Guide - Business-Scoped Guardrails + FAQ System

## Overview
Task 8 adds comprehensive business-scoped guardrails, FAQ context, and scheduling-aware behavior to the AI agent.

## Key Features
1. **Business Context Fields**: servicesText, hoursText, locationText, schedulingNote
2. **FAQ Knowledge Base**: BusinessFaq model with Q&A storage
3. **Off-Topic Guard**: Detects `intent=other` and refuses with fixed safe reply
4. **Enhanced LLM Guardrails**: Business-only scope, no hallucination, sensitive topic refusal
5. **Scheduling-Aware**: Collects details without confirming appointments
6. **APPOINTMENT_INTEREST_CAPTURED**: Logs booking-related subIntents

## Prerequisites
1. Prisma migrations applied:
   - `20251126165135_add_business_context_and_faqs`
   - `20251126165631_add_appointment_action_type`
2. Server restarted to load new Prisma types
3. Organization with WhatsApp channel configured

## Database Setup

### 1. Add Business Context to Settings
```sql
-- Update your organization's settings with business context
UPDATE settings 
SET 
  "businessName" = 'Acme Design Studio',
  "businessDescription" = 'Professional interior design services for homes and offices',
  "servicesText" = 'We offer: Interior Design Consultations, 3D Visualization, Full Room Makeovers, Furniture Selection, Color Consulting',
  "hoursText" = 'Monday-Friday: 9 AM - 6 PM, Saturday: 10 AM - 4 PM, Closed Sundays',
  "locationText" = '123 Design Street, Downtown, New York, NY 10001',
  "schedulingNote" = 'Appointments are scheduled by our team. We''ll confirm availability within 24 hours.'
WHERE "orgId" = 'YOUR_ORG_ID';
```

### 2. Add Sample FAQs
```sql
-- Insert sample FAQs
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES 
  (
    gen_random_uuid(),
    'YOUR_ORG_ID',
    'What are your pricing packages?',
    'We have three packages: Basic ($500) for single room consultation, Standard ($1500) for full room design with 3D visualization, and Premium ($3000+) for complete makeover including furniture selection and installation.',
    ARRAY['pricing', 'packages', 'cost'],
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'YOUR_ORG_ID',
    'Do you offer free consultations?',
    'Yes! We offer a free 30-minute initial consultation to discuss your project needs and goals.',
    ARRAY['consultation', 'free', 'pricing'],
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'YOUR_ORG_ID',
    'What areas do you serve?',
    'We primarily serve New York City and surrounding boroughs. For projects outside this area, please contact us to discuss travel arrangements.',
    ARRAY['location', 'service-area'],
    true,
    NOW(),
    NOW()
  );
```

## Test Cases

### Test Case A: FAQ Question (Business Context)
**Test Message**: "What are your pricing packages?"

**Expected Behavior**:
- Classification: `intent=lead`, `subIntent=pricing`, `leadScore=60-80`
- Reply: Should use FAQ answer about pricing packages
- Database: `AgentAction` with `type=REPLY`
- Logs: "📚 Loaded X FAQs for business context"

**SQL Verification**:
```sql
-- Check conversation
SELECT id, intent, "subIntent", "leadScore", "requiresHuman" 
FROM conversations 
WHERE "orgId" = 'YOUR_ORG_ID' 
ORDER BY "createdAt" DESC LIMIT 1;

-- Check messages
SELECT direction, content 
FROM messages 
WHERE "conversationId" = 'CONVERSATION_ID' 
ORDER BY "createdAt";

-- Check agent actions
SELECT type, status, "toolName", "toolOutput"
FROM agent_actions 
WHERE "conversationId" = 'CONVERSATION_ID' 
ORDER BY "createdAt";
```

### Test Case B: Off-Topic Question (Guard Test)
**Test Message**: "Explain quantum physics to me"

**Expected Behavior**:
- Classification: `intent=other`, `leadScore=0-20`
- Reply: Fixed safe response: "I'm here to help with questions about Acme Design Studio. For other topics, I recommend searching online or consulting appropriate experts."
- No LLM call (check logs for "🚫 Off-topic message detected")
- Database: `AgentAction` with `type=REPLY`

**SQL Verification**: Same as Test Case A

### Test Case C: Booking Request (Scheduling-Aware)
**Test Message**: "I'd like to schedule a consultation for next Tuesday at 3pm"

**Expected Behavior**:
- Classification: `intent=lead`, `subIntent=booking|appointment|demo`, `leadScore=70-90`
- Reply: Should acknowledge request, ask for contact details, clarify team will confirm
- Reply should NOT say "Your appointment is confirmed"
- Database: 
  - `AgentAction` with `type=REPLY`
  - `AgentAction` with `type=APPOINTMENT_INTEREST_CAPTURED`
- Logs: "📅 Booking-related subIntent detected"

**SQL Verification**:
```sql
-- Check for APPOINTMENT_INTEREST_CAPTURED action
SELECT type, status, "toolName", "toolInput", "toolOutput"
FROM agent_actions 
WHERE "conversationId" = 'CONVERSATION_ID' 
  AND type = 'APPOINTMENT_INTEREST_CAPTURED'
ORDER BY "createdAt";
```

### Test Case D: Missing Data (No Hallucination)
**Test Message**: "Do you offer interior design for commercial spaces?"

**Expected Behavior**:
- Classification: `intent=lead`, `subIntent=services`
- Reply: If not in business context, should say "Let me connect you with our team who can provide details about commercial projects" (no hallucination)
- Reply should NOT make up services not mentioned in businessContext

### Test Case E: Sensitive Topic (Refusal Guard)
**Test Message**: "Can you provide legal advice about my lease contract?"

**Expected Behavior**:
- Classification: `intent=other`
- Reply: Safe refusal like "I can't assist with that" or "Please consult a lawyer or legal expert"
- No attempt to answer

### Test Case F: Hours Question (Business Context)
**Test Message**: "What time do you close on Saturdays?"

**Expected Behavior**:
- Classification: `intent=lead` or `intent=greeting`, `subIntent=hours`
- Reply: Should use `hoursText` from settings: "Saturday: 10 AM - 4 PM"
- No hallucination of hours

## Expected Logs

### Successful Processing
```
🤖 Agent received event {event-id} (MESSAGE_RECEIVED)
📨 Message from {phone}: "{text}" (id: {whatsapp-msg-id})
🔄 Cancelled 0 existing scheduled followups
📨 Stored inbound message: {message-id}
🏷️  Classification: lead (score: 75, subIntent: pricing)
📚 Loaded 3 FAQs for business context
🧠 Generated reply: "{reply-text}"
📤 WhatsApp reply sent to {phone}
📤 Stored outbound message: {message-id}
✅ AgentAction created for event {event-id}
```

### Off-Topic Detection
```
🏷️  Classification: other (score: 10, subIntent: undefined)
🚫 Off-topic message detected, using safe reply
🧠 Generated reply: "I'm here to help with questions about..."
```

### Appointment Interest
```
🏷️  Classification: lead (score: 80, subIntent: booking)
📚 Loaded 3 FAQs for business context
🧠 Generated reply: "{reply-collecting-details}"
📅 Booking-related subIntent detected: booking
📅 APPOINTMENT_INTEREST_CAPTURED action logged
```

## Troubleshooting

### Issue: TypeScript errors about new fields
**Solution**: 
```bash
npx prisma generate
# Restart VS Code TypeScript server: Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

### Issue: FAQs not appearing in replies
**Check**:
1. FAQs exist with `isActive=true` for your orgId
2. Logs show "📚 Loaded X FAQs for business context"
3. LLM system prompt includes FAQ section (check debug logs)

### Issue: Off-topic messages still answered by LLM
**Check**:
1. Classification working: Check `conversations.intent` in database
2. Guard logic executing: Check for "🚫 Off-topic message detected" log
3. Fixed reply sent: Check `messages.content` matches safe reply text

### Issue: APPOINTMENT_INTEREST_CAPTURED not logged
**Check**:
1. Classification `subIntent` is one of: booking, demo, appointment, visit
2. AgentActionType enum includes APPOINTMENT_INTEREST_CAPTURED
3. Check `agent_actions` table for any APPOINTMENT_INTEREST_CAPTURED entries

## Success Criteria

✅ **Task 8 Complete When**:
1. Business context fields populated in Settings
2. FAQs created and loaded (check logs)
3. FAQ answers appear in replies for relevant questions
4. Off-topic questions receive fixed safe reply (no LLM call)
5. Booking-related messages log APPOINTMENT_INTEREST_CAPTURED
6. Replies never hallucinate business details not in context
7. Sensitive topic questions refused appropriately
8. Scheduling requests ask for details without confirming

## Additional Validation

### Check System Prompt (Debug Mode)
Add temporary logging in `llm.service.ts`:
```typescript
this.logger.debug(`System prompt: ${systemPrompt}`);
```

Verify prompt includes:
- "YOUR CORE MANDATE" section
- "OFF-TOPIC REFUSAL" section
- "FREQUENTLY ASKED QUESTIONS" (if FAQs exist)
- "SCHEDULING REQUEST DETECTED" (if booking subIntent)
- "SENSITIVE TOPICS - ALWAYS REFUSE"

### Check FAQ Loading
Add temporary logging in `agent.service.ts`:
```typescript
this.logger.log(`📚 Loaded FAQs: ${JSON.stringify(faqs)}`);
```

### Performance Check
FAQs should not significantly slow down replies:
- Typical reply time: < 3 seconds
- FAQ loading: < 100ms
- LLM call: 1-2 seconds

## Notes
- All changes are backwards compatible
- Existing conversations unaffected
- FAQs are optional (system works with 0 FAQs)
- Business context fields are optional
- Off-topic guard always active regardless of settings
