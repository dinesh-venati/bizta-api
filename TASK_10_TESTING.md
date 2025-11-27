# Task 10: AI Pause/Resume (Human Handoff Control) - Testing Guide

## Overview
Task 10 implements a human handoff system where the AI can be paused/resumed for specific conversations, allowing owners to take control when needed.

## Features Implemented

### Backend
1. **Database Schema**
   - Added `inHumanHandling` boolean field to `Conversation` model (default: false)
   - Migration: `20251127125746_add_in_human_handling_to_conversation`

2. **API Endpoints**
   - `POST /api/v1/dashboard/conversations/:id/takeover` - Take over conversation as human (pause AI)
   - `POST /api/v1/dashboard/conversations/:id/release` - Release conversation back to AI
   - Updated `POST /api/v1/dashboard/conversations/:id/reply` - Auto-enables human handoff

3. **AI Guard**
   - AgentService now checks `inHumanHandling` flag before processing
   - Skips AI classification, replies, and followup scheduling when flag is true
   - Logs skip action for audit trail

4. **Automatic Behaviors**
   - When human replies: sets `inHumanHandling = true`, cancels pending followups
   - When takeover: sets `inHumanHandling = true`, cancels pending followups
   - When release: sets `inHumanHandling = false`

### Frontend
1. **Conversation Detail Page**
   - Status badge: "🤖 AI Active" (green) or "🙋 Human Handling" (orange)
   - Control buttons: "Take Over as Human" or "Release to AI"
   - Success messages after takeover/release
   - Real-time updates via TanStack Query

## Test Scenarios

### Scenario 1: AI Active by Default ✅
**Objective**: Verify AI operates normally for new conversations

**Steps**:
1. Start a new WhatsApp conversation as a customer
2. Send a message to the business WhatsApp number
3. Check database: `SELECT id, inHumanHandling FROM conversations ORDER BY createdAt DESC LIMIT 1;`
4. Check dashboard: Conversation should show "🤖 AI Active" badge
5. Wait for AI response

**Expected Results**:
- `inHumanHandling` should be `false` in database
- Bizta auto-replies with AI-generated message
- Followup task is scheduled (if applicable)
- AgentActions are created for classification and reply
- Dashboard shows green "AI Active" badge

---

### Scenario 2: Human Takeover via Reply 🙋
**Objective**: Verify that sending a manual reply automatically pauses AI

**Steps**:
1. Use conversation from Scenario 1 (or create new one)
2. Login to dashboard at http://localhost:3001/dashboard
3. Navigate to Conversations → Select the conversation
4. Type a message in "Send Human Reply" form
5. Click "Send Message"
6. Check database: `SELECT id, inHumanHandling, requiresHuman FROM conversations WHERE id = 'CONVERSATION_ID';`
7. Check logs for: `[DASHBOARD] Human reply sent successfully`
8. Send another inbound message from the customer
9. Check logs for: `⏸️ Skipping AI processing`

**Expected Results**:
- Manual reply appears in chat as green bubble with "You" label
- `inHumanHandling` changes to `true` in database
- `requiresHuman` changes to `true`
- Badge changes to orange "🙋 Human Handling"
- Pending followups are cancelled
- Subsequent customer messages DO NOT trigger AI replies
- Logs show: "Skipping AI processing for conversation ... (inHumanHandling=true)"

---

### Scenario 3: Explicit Takeover & Release 🔄
**Objective**: Verify manual takeover/release buttons work correctly

**Part A: Takeover**
1. Start a fresh conversation (or use one with `inHumanHandling = false`)
2. In dashboard, open the conversation detail page
3. Verify badge shows "🤖 AI Active"
4. Click "🙋 Take Over as Human" button
5. Wait for success message: "✓ You are now handling this conversation. AI has been paused."
6. Check database for `inHumanHandling = true`
7. Send inbound message from customer

**Expected Results**:
- Badge changes to "🙋 Human Handling" (orange)
- Button changes to "✅ Release to AI"
- Success toast appears
- Database: `inHumanHandling = true`, `requiresHuman = true`
- Pending followups cancelled
- Inbound messages do NOT trigger AI (check logs for skip message)

**Part B: Release**
1. Continue from Part A (conversation in human handoff mode)
2. Click "✅ Release to AI" button
3. Wait for success message: "✓ AI resumed for this conversation."
4. Check database for `inHumanHandling = false`
5. Send another inbound message from customer

**Expected Results**:
- Badge changes to "🤖 AI Active" (green)
- Button changes to "🙋 Take Over as Human"
- Success toast appears
- Database: `inHumanHandling = false`, `requiresHuman = false`
- AI resumes normal operation
- New inbound message triggers AI classification and reply
- New followup can be scheduled

---

### Scenario 4: Edge Cases 🧪
**Objective**: Verify system handles complex workflows correctly

**Test 4.1: Multiple Human Replies**
1. Take over conversation or send first human reply
2. Send 2-3 more human replies
3. Check that `inHumanHandling` remains `true` throughout

**Expected**: Flag stays `true`, AI never auto-replies

**Test 4.2: Release Then Reply Again**
1. Take over conversation (or reply as human)
2. Release to AI
3. Immediately send another human reply from dashboard
4. Check database

**Expected**: 
- After release: `inHumanHandling = false`
- After new reply: `inHumanHandling = true` again
- AI correctly switches modes

**Test 4.3: Concurrent Operations**
1. Take over conversation
2. While in human mode, send multiple human replies
3. Release to AI
4. Send customer message immediately
5. Take over again quickly

**Expected**: System handles state transitions gracefully without race conditions

**Test 4.4: Followup Cancellation**
1. Create conversation with pending followup
2. Take over as human
3. Check followup tasks: `SELECT * FROM followup_tasks WHERE conversationId = 'CONVERSATION_ID';`

**Expected**: Pending followups status changed to 'CANCELLED'

---

## Verification Checklist

### Database Checks
```sql
-- Check conversation state
SELECT id, customerPhone, inHumanHandling, requiresHuman, status 
FROM conversations 
WHERE id = 'CONVERSATION_ID';

-- Check followup tasks
SELECT id, status, scheduledAt, conversationId 
FROM followup_tasks 
WHERE conversationId = 'CONVERSATION_ID' 
ORDER BY createdAt DESC;

-- Check messages
SELECT id, direction, content, metadata 
FROM messages 
WHERE conversationId = 'CONVERSATION_ID' 
ORDER BY createdAt DESC;
```

### Log Checks
Look for these log entries:
- `[TAKEOVER] Human taking over conversation`
- `[TAKEOVER] AI paused for conversation`
- `[RELEASE] Releasing conversation to AI`
- `[RELEASE] AI resumed for conversation`
- `⏸️ Skipping AI processing for conversation ... (inHumanHandling=true)`
- `[DASHBOARD] Human reply sent successfully`

### UI Checks
- [ ] Badge shows correct status (AI Active vs Human Handling)
- [ ] Correct button displays (Take Over vs Release)
- [ ] Success messages appear after actions
- [ ] Page refetches data automatically after mutation
- [ ] No console errors in browser

### API Checks (via Postman)
1. Test `/dashboard/conversations/:id/takeover`
   - Returns: `{ id, inHumanHandling: true, requiresHuman: true }`
2. Test `/dashboard/conversations/:id/release`
   - Returns: `{ id, inHumanHandling: false, requiresHuman: false }`
3. Test `/dashboard/conversations/:id/reply`
   - After reply, GET conversation detail shows `inHumanHandling: true`

---

## Known Behaviors

1. **Automatic Handoff**: Any human reply automatically enables human handoff mode
2. **Followup Cancellation**: Both manual reply and explicit takeover cancel pending followups
3. **No Retroactive AI**: When AI is paused, existing messages don't get re-classified
4. **Persistent State**: Handoff state persists across server restarts (stored in DB)
5. **Org-Scoped**: All operations are properly scoped to organization via JWT token

---

## Troubleshooting

### AI Still Replies When in Human Mode
- Check database: `inHumanHandling` should be `true`
- Check logs: Should see "Skipping AI processing" message
- Verify AgentService has the guard check (around line 105)

### Button Doesn't Change State
- Check browser console for errors
- Verify API endpoints return 200 status
- Check that TanStack Query is invalidating cache

### Followups Still Send
- Verify followup cancellation logic in takeover/reply methods
- Check followup_tasks table for CANCELLED status
- Ensure FollowupService respects conversation state

---

## Success Criteria

Task 10 is successful if:
1. ✅ All 4 test scenarios pass
2. ✅ Database migration applied cleanly
3. ✅ Backend builds without errors
4. ✅ Frontend builds without errors
5. ✅ No console errors in browser
6. ✅ Logs clearly show handoff state changes
7. ✅ AI correctly skips processing when `inHumanHandling = true`
8. ✅ UI correctly displays handoff status and controls
9. ✅ Postman collection has updated endpoints

---

## Next Steps After Testing

Once testing is complete:
1. Deploy database migration to production
2. Deploy backend to Render
3. Deploy frontend to Render
4. Update Postman collection
5. Document feature in user guide
6. Consider future enhancements:
   - Auto-release after N hours of inactivity
   - Notification when customer replies during human handoff
   - History of handoff events in conversation detail
