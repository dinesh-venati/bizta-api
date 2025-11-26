import { Injectable, Logger } from '@nestjs/common';
import { Event, EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LlmService } from '@/modules/llm/llm.service';
import { MessagingService } from '@/modules/skills/messaging/messaging.service';
import { ConversationsService } from '@/modules/conversations/conversations.service';
import { MessagesService } from '@/modules/messages/messages.service';
import { FollowupService } from '@/modules/skills/followup/followup.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly messaging: MessagingService,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
    private readonly followup: FollowupService,
  ) {}

  /**
   * Process event - Agent orchestrator entry point
   * Handles incoming events and orchestrates AI-powered responses
   */
  async processEvent(event: Event): Promise<void> {
    this.logger.log(`🤖 Agent received event ${event.id} (${event.type})`);

    try {
      // Load organization settings
      const settings = await this.prisma.settings.findUnique({
        where: { orgId: event.orgId },
      });

      if (!settings) {
        this.logger.warn(`No settings found for org ${event.orgId}`);
        await this.updateEventStatus(event.id, EventStatus.FAILED);
        return;
      }

      this.logger.debug(
        `Org settings: autoReply=${settings.autoReply}, agentName=${settings.agentName}`,
      );

      // Handle MESSAGE_RECEIVED events
      if (event.type === 'MESSAGE_RECEIVED') {
        await this.handleMessageReceived(event, {
          autoReply: settings.autoReply,
          agentName: settings.agentName,
          autoFollowup: settings.autoFollowup,
          followupDelayHours: settings.followupDelayHours,
          followupMessageTemplate: settings.followupMessageTemplate,
        });
      } else {
        this.logger.log(`Event type ${event.type} not handled yet`);
      }

      // Mark event as completed
      await this.updateEventStatus(event.id, EventStatus.COMPLETED);
      this.logger.log(`✅ Event ${event.id} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process event ${event.id}: ${error.message}`, error.stack);
      await this.updateEventStatus(event.id, EventStatus.FAILED);
    }
  }

  /**
   * Handle MESSAGE_RECEIVED events from WhatsApp
   */
  private async handleMessageReceived(
    event: Event,
    settings: {
      autoReply: boolean;
      agentName: string;
      autoFollowup: boolean;
      followupDelayHours: number;
      followupMessageTemplate?: string | null;
    },
  ): Promise<void> {
    // Parse event payload
    const payload = event.payload as Prisma.JsonObject;
    const from = payload.from as string;
    const messageText = payload.text as string;
    const messageId = payload.messageId as string;

    this.logger.log(`📨 Message from ${from}: "${messageText}" (id: ${messageId})`);

    // Check if auto-reply is enabled
    if (!settings.autoReply) {
      this.logger.log('Auto-reply disabled, skipping response');
      return;
    }

    // 1. Find or create conversation
    let conversation = await this.conversations.findOrCreateByContact({
      orgId: event.orgId,
      channelType: 'whatsapp',
      customerPhone: from,
      externalId: from,
      customerName: from, // Use phone as name initially
    });

    this.logger.log(`💬 Conversation: ${conversation.id}`);

    // 2. Store incoming message
    const inboundMessage = await this.messages.create({
      conversationId: conversation.id,
      orgId: event.orgId,
      direction: 'inbound',
      content: messageText,
      rawPayload: payload,
      externalId: messageId,
    });

    this.logger.log(`📥 Stored inbound message: ${inboundMessage.id}`);

    // Cancel any pending followups since customer replied
    try {
      await this.followup.cancelFollowupForConversation(conversation.id);
    } catch (error) {
      this.logger.warn(
        `Failed to cancel followup for conversation ${conversation.id}: ${error.message}`,
      );
      // Continue processing even if cancellation fails
    }

    // 3. Classify conversation and qualify lead (Task 7)
    const recentMessages = await this.conversations.getRecentMessagesForConversation(
      conversation.id,
      6,
    );

    const classification = await this.llm.classifyConversation({
      orgName: settings.agentName || 'Bizta',
      businessDescription: settings.agentName || 'Bizta',
      recentMessages,
    });

    this.logger.log(
      `🏷️  Classification: ${classification.intent} (score: ${classification.leadScore}, subIntent: ${classification.subIntent})`,
    );

    // Map intent to enum
    const intentMap: Record<string, 'LEAD' | 'SUPPORT' | 'SPAM' | 'GREETING' | 'OTHER'> = {
      lead: 'LEAD',
      support: 'SUPPORT',
      spam: 'SPAM',
      greeting: 'GREETING',
      other: 'OTHER',
    };

    const conversationIntent = intentMap[classification.intent] || 'OTHER';

    // Update conversation with classification
    await this.conversations.updateClassification({
      conversationId: conversation.id,
      intent: conversationIntent,
      subIntent: classification.subIntent,
      leadScore: classification.leadScore,
      requiresHuman: classification.requiresHuman,
    });

    // Refetch conversation to get updated fields
    conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });

    // Create AgentAction for classification
    await this.prisma.agentAction.create({
      data: {
        orgId: event.orgId,
        eventId: event.id,
        conversationId: conversation.id,
        type: 'LEAD_QUALIFIED',
        status: 'COMPLETED',
        toolName: 'LlmService.classifyConversation',
        toolInput: {
          messagesAnalyzed: recentMessages.length,
        } as Prisma.JsonObject,
        toolOutput: {
          intent: classification.intent,
          subIntent: classification.subIntent,
          leadScore: classification.leadScore,
          requiresHuman: classification.requiresHuman,
          reasoning: classification.reasoning,
        } as Prisma.JsonObject,
      },
    });

    // Check if human intervention is required
    if (classification.requiresHuman) {
      this.logger.warn(
        `⚠️  Conversation ${conversation.id} flagged as requiresHuman for org ${event.orgId}`,
      );
      // TODO: Add alert mechanism in future task
    }

    // Skip processing for spam
    if (
      classification.intent === 'spam' ||
      (classification.leadScore && classification.leadScore < 25)
    ) {
      this.logger.log('🚫 Skipping reply and followup for spam/low-quality message');
      return;
    }

    // 4. Generate reply using LLM (with conversation context)
    const replyText = await this.llm.generateReplyForMessage({
      orgId: event.orgId,
      messageText,
      channel: 'whatsapp',
      businessContext: {
        businessName: settings.agentName || 'Bizta',
        conversationHistory: recentMessages,
        leadScore: classification.leadScore,
        requiresHuman: classification.requiresHuman,
      },
    });

    this.logger.log(`🧠 LLM generated reply: "${replyText}"`);

    // 4. Send reply via WhatsApp
    await this.messaging.sendWhatsAppText({
      to: from,
      text: replyText,
      orgId: event.orgId,
      metadata: {
        conversationId: conversation.id,
        inboundMessageId: inboundMessage.id,
      },
    });

    this.logger.log(`📤 WhatsApp reply sent to ${from}`);

    // 5. Store the outbound message
    const outboundMessage = await this.messages.create({
      conversationId: conversation.id,
      orgId: event.orgId,
      direction: 'outbound',
      content: replyText,
      rawPayload: { replyTo: messageId } as Prisma.JsonObject,
    });

    this.logger.log(`📤 Stored outbound message: ${outboundMessage.id}`);

    // 6. Create reply AgentAction record
    await this.prisma.agentAction.create({
      data: {
        orgId: event.orgId,
        eventId: event.id,
        conversationId: conversation.id,
        type: 'REPLY',
        status: 'COMPLETED',
        toolName: 'MessagingSkill.sendWhatsAppText',
        toolInput: {
          prompt: messageText,
          to: from,
        } as Prisma.JsonObject,
        toolOutput: {
          response: replyText,
          messageId: outboundMessage.id,
        } as Prisma.JsonObject,
      },
    });

    this.logger.log(`✅ AgentAction created for event ${event.id}`);

    // 7. Schedule followup reminder if enabled (shorter delay for hot leads)
    if (settings.autoFollowup && settings.followupDelayHours > 0) {
      // Use half delay for hot leads (leadScore >= 80)
      const isHotLead = conversation.leadScore !== null && conversation.leadScore >= 80;
      const effectiveDelay = isHotLead
        ? Math.max(1, settings.followupDelayHours / 2)
        : settings.followupDelayHours;

      if (isHotLead) {
        this.logger.log(
          `🔥 Hot lead detected (score: ${conversation.leadScore}), using ${effectiveDelay}h followup delay`,
        );
      }
      try {
        await this.followup.scheduleCustomerFollowup({
          orgId: event.orgId,
          conversationId: conversation.id,
          customerPhone: from,
          channel: 'whatsapp',
          delayHours: effectiveDelay,
          messageTemplate: settings.followupMessageTemplate || undefined,
        });
      } catch (error) {
        this.logger.error(
          `Failed to schedule followup for conversation ${conversation.id}: ${error.message}`,
        );
        // Don't fail the whole event if followup scheduling fails
      }
    }
  }

  /**
   * Update event status
   */
  private async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: { status },
    });
  }
}
