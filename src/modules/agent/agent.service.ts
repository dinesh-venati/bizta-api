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
    const conversation = await this.conversations.findOrCreateByContact({
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

    // 3. Generate reply using LLM
    const replyText = await this.llm.generateReplyForMessage({
      orgId: event.orgId,
      messageText,
      channel: 'whatsapp',
      businessContext: {
        businessName: settings.agentName || 'Bizta',
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

    // 5. Store outbound message
    const outboundMessage = await this.messages.create({
      conversationId: conversation.id,
      orgId: event.orgId,
      direction: 'outbound',
      content: replyText,
      rawPayload: { replyTo: messageId } as Prisma.JsonObject,
    });

    this.logger.log(`📤 Stored outbound message: ${outboundMessage.id}`);

    // 6. Create AgentAction record
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

    // 7. Schedule followup reminder if enabled
    if (settings.autoFollowup && settings.followupDelayHours > 0) {
      try {
        await this.followup.scheduleCustomerFollowup({
          orgId: event.orgId,
          conversationId: conversation.id,
          customerPhone: from,
          channel: 'whatsapp',
          delayHours: settings.followupDelayHours,
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
