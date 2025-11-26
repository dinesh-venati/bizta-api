# Task 7: Lead Qualification & Intent Classification - Testing Guide

## Overview
Task 7 implements automatic conversation classification, lead scoring, and intent detection using GPT-4o-mini.

## What's New

### Database Changes
- **ConversationIntent enum**: LEAD, SUPPORT, SPAM, GREETING, OTHER
- **Conversation fields**:
  - `intent` - Main conversation intent
  - `subIntent` - Specific intent (e.g., "pricing", "demo", "complaint")
  - `leadScore` - Quality score from 0-100
  - `requiresHuman` - Boolean flag for escalation

### Classification Logic
- Runs automatically after every inbound message
- Analyzes last 6 messages for context
- Creates `LEAD_QUALIFIED` AgentAction with classification details
- Logs warning if `requiresHuman` flag is set

### Smart Behavior
1. **Spam Filtering**: Skips reply & followup if leadScore < 25
2. **Hot Lead Priority**: Uses 50% followup delay if leadScore ≥ 80
3. **Human Escalation**: Flags angry/complex conversations

## Lead Scoring Tiers
- **0-20**: Spam (no reply/followup)
- **20-40**: Low quality lead
- **40-60**: Lukewarm prospect
- **60-80**: Good lead
- **80-100**: Hot lead (priority followup)

## Testing Steps

### 1. Start the Server
```powershell
npm run start:dev
```

Server should be running at: `http://localhost:3000/api/v1`

### 2. Test Cases

#### Test Case 1: Hot Lead (High Intent)
**Message**: "Hi! I need pricing for 50 units. Can we schedule a call this week?"

**Expected Classification**:
- Intent: `lead`
- SubIntent: `pricing` or `demo`
- LeadScore: 75-95
- RequiresHuman: false

**Expected Behavior**:
- ✅ Reply sent
- ✅ Followup scheduled with 50% delay (hot lead)
- ✅ Classification logged
- ✅ LEAD_QUALIFIED AgentAction created

**Expected Logs**:
```
📨 Message from +1234567890: "Hi! I need pricing for 50 units..."
💬 Conversation: <uuid>
📥 Stored inbound message: <uuid>
🏷️  Classification: lead (score: 85, subIntent: pricing)
🔥 Hot lead detected (score: 85), using 12h followup delay
🧠 LLM generated reply: "..."
📤 WhatsApp reply sent to +1234567890
```

---

#### Test Case 2: Greeting
**Message**: "Hello!"

**Expected Classification**:
- Intent: `greeting`
- SubIntent: `hello` or `hi`
- LeadScore: 30-50
- RequiresHuman: false

**Expected Behavior**:
- ✅ Reply sent (friendly greeting)
- ✅ Normal followup scheduled
- ✅ Classification logged

---

#### Test Case 3: Support Request
**Message**: "I'm having trouble with my order #12345. It hasn't arrived yet."

**Expected Classification**:
- Intent: `support`
- SubIntent: `order_issue` or `complaint`
- LeadScore: 40-60
- RequiresHuman: false or true (if angry tone)

**Expected Behavior**:
- ✅ Reply sent with support response
- ✅ Normal followup scheduled
- ⚠️ May flag requiresHuman if complaint is serious

---

#### Test Case 4: Spam
**Message**: "🎉 Click here for FREE CRYPTO! 💰 Limited time offer!!!"

**Expected Classification**:
- Intent: `spam`
- SubIntent: `scam` or `advertisement`
- LeadScore: 0-20
- RequiresHuman: false

**Expected Behavior**:
- 🚫 NO reply sent
- 🚫 NO followup scheduled
- ✅ Classification logged
- ✅ Spam filtering message: "Skipping reply and followup for spam/low-quality message"

**Expected Logs**:
```
📨 Message from +1234567890: "🎉 Click here for FREE CRYPTO!..."
💬 Conversation: <uuid>
📥 Stored inbound message: <uuid>
🏷️  Classification: spam (score: 5, subIntent: scam)
🚫 Skipping reply and followup for spam/low-quality message
```

---

#### Test Case 5: Angry Customer (Requires Human)
**Message**: "This is UNACCEPTABLE! I want a FULL REFUND NOW or I'm calling my lawyer!"

**Expected Classification**:
- Intent: `support` or `other`
- SubIntent: `escalation` or `refund`
- LeadScore: 40-60
- RequiresHuman: **true**

**Expected Behavior**:
- ✅ Reply sent (empathetic response)
- ✅ Normal followup scheduled
- ⚠️ Warning logged: "Conversation flagged as requiresHuman"

**Expected Logs**:
```
🏷️  Classification: support (score: 50, subIntent: escalation)
⚠️  Conversation <uuid> flagged as requiresHuman for org <orgId>
```

---

### 3. Send Test Messages

Use Postman or curl to send messages via WhatsApp webhook:

```bash
POST http://localhost:3000/api/v1/webhooks/whatsapp
Content-Type: application/json

{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "1234567890",
          "text": { "body": "Hi! I need pricing for 50 units. Can we schedule a call this week?" },
          "id": "wamid.test123",
          "timestamp": "1732654321"
        }],
        "metadata": {
          "phone_number_id": "YOUR_PHONE_NUMBER_ID"
        }
      }
    }]
  }]
}
```

### 4. Verify in Database

#### Check Conversation Classification
```sql
SELECT 
  id,
  customerPhone,
  intent,
  subIntent,
  leadScore,
  requiresHuman,
  status
FROM conversations
ORDER BY createdAt DESC
LIMIT 5;
```

#### Check LEAD_QUALIFIED AgentActions
```sql
SELECT 
  id,
  type,
  status,
  toolName,
  "toolOutput"->>'intent' as intent,
  "toolOutput"->>'leadScore' as leadScore,
  "toolOutput"->>'reasoning' as reasoning,
  createdAt
FROM agent_actions
WHERE type = 'LEAD_QUALIFIED'
ORDER BY createdAt DESC
LIMIT 5;
```

#### Check Hot Leads
```sql
SELECT 
  id,
  customerPhone,
  intent,
  subIntent,
  leadScore,
  createdAt
FROM conversations
WHERE leadScore >= 80
ORDER BY createdAt DESC;
```

#### Check Spam Messages
```sql
SELECT 
  id,
  customerPhone,
  intent,
  leadScore,
  createdAt
FROM conversations
WHERE intent = 'SPAM' OR leadScore < 25
ORDER BY createdAt DESC;
```

### 5. View in Prisma Studio

```powershell
npm run prisma:studio
```

Navigate to:
- **Conversations** table - See intent, subIntent, leadScore, requiresHuman fields
- **AgentActions** table - Filter by type = LEAD_QUALIFIED
- **Messages** table - See conversation flow

## Expected Classification Examples

### Example 1: High-Intent Lead
```json
{
  "intent": "lead",
  "subIntent": "pricing",
  "leadScore": 85,
  "requiresHuman": false,
  "reasoning": "Customer is asking for pricing information for a specific quantity and wants to schedule a call. Clear buying intent with urgency. High-quality lead."
}
```

### Example 2: Support Request
```json
{
  "intent": "support",
  "subIntent": "order_issue",
  "leadScore": 50,
  "requiresHuman": false,
  "reasoning": "Customer reporting a problem with their order. Existing customer seeking assistance. Medium priority."
}
```

### Example 3: Spam
```json
{
  "intent": "spam",
  "subIntent": "scam",
  "leadScore": 5,
  "requiresHuman": false,
  "reasoning": "Message contains promotional spam with suspicious links and excessive emojis. Clear spam pattern."
}
```

### Example 4: Requires Human Escalation
```json
{
  "intent": "support",
  "subIntent": "escalation",
  "leadScore": 45,
  "requiresHuman": true,
  "reasoning": "Customer is extremely angry and threatening legal action. Requires immediate human intervention to de-escalate and resolve."
}
```

## Success Criteria

✅ **Classification runs automatically** after each inbound message  
✅ **Spam is filtered** - no reply/followup for leadScore < 25  
✅ **Hot leads get priority** - 50% followup delay for leadScore ≥ 80  
✅ **Human escalation detected** - requiresHuman flag logged  
✅ **LEAD_QUALIFIED AgentAction** created with classification details  
✅ **Database updated** - intent, subIntent, leadScore, requiresHuman populated  
✅ **Proper logging** - Classification details visible in console  

## Troubleshooting

### Issue: Classification not running
- Check logs for "🏷️ Classification:" message
- Verify LLM service is configured (OPENAI_API_KEY in .env)
- Check recent messages are being fetched

### Issue: Spam still getting replies
- Check leadScore in database (should be < 25)
- Verify spam detection log: "🚫 Skipping reply and followup..."
- Check classification intent (should be 'spam')

### Issue: Hot leads not getting priority followup
- Check log for "🔥 Hot lead detected"
- Verify leadScore ≥ 80 in database
- Check followup delay (should be half of normal delay)

### Issue: LEAD_QUALIFIED AgentAction not created
- Check for TypeScript errors in build
- Verify Prisma Client regenerated after migration
- Check AgentActionType enum includes LEAD_QUALIFIED

## Next Steps

After verifying Task 7 works correctly:

1. **Monitor classification accuracy** - Review LLM classifications for edge cases
2. **Tune lead scoring** - Adjust thresholds based on real data
3. **Implement alert system** - Add notifications for requiresHuman flags
4. **Add dashboard** - Visualize lead scores and intent distribution
5. **A/B test followup delays** - Measure conversion rates for hot leads

## Summary

Task 7 adds intelligent conversation classification that:
- Automatically scores every lead from 0-100
- Filters out spam to save resources
- Prioritizes hot leads with faster followups
- Flags conversations that need human attention
- Provides detailed reasoning for each classification

This enables smarter, more efficient customer engagement at scale.
