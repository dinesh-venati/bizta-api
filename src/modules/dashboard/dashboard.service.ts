import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MessagingService } from '@/modules/skills/messaging/messaging.service';
import { ConversationIntent, Prisma } from '@prisma/client';
import {
  DashboardSummaryDto,
  ConversationListResponseDto,
  ConversationDetailDto,
  ReplyResponseDto,
} from './dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Get summary stats for the dashboard for a specific date
   */
  async getTodaySummary(
    orgId: string,
    dateRange: 'today' | 'yesterday' | 'dayBeforeYesterday' = 'today',
  ): Promise<DashboardSummaryDto> {
    // Calculate the date range based on selection
    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);

    if (dateRange === 'yesterday') {
      targetDate.setDate(targetDate.getDate() - 1);
    } else if (dateRange === 'dayBeforeYesterday') {
      targetDate.setDate(targetDate.getDate() - 2);
    }

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Total conversations with activity on the selected date
    const totalConversationsToday = await this.prisma.conversation.count({
      where: {
        orgId,
        OR: [
          {
            createdAt: {
              gte: targetDate,
              lt: nextDay,
            },
          },
          {
            lastMessageAt: {
              gte: targetDate,
              lt: nextDay,
            },
          },
        ],
      },
    });

    // New conversations created on the selected date
    const newConversationsToday = await this.prisma.conversation.count({
      where: {
        orgId,
        createdAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    // Messages from customers on the selected date
    const totalMessagesFromCustomersToday = await this.prisma.message.count({
      where: {
        orgId,
        direction: 'INBOUND',
        createdAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    // Messages from Bizta on the selected date
    const totalMessagesFromBiztaToday = await this.prisma.message.count({
      where: {
        orgId,
        direction: 'OUTBOUND',
        createdAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    // Conversations needing human attention (current state, not date-specific)
    const conversationsNeedingHuman = await this.prisma.conversation.count({
      where: {
        orgId,
        requiresHuman: true,
      },
    });

    // Count conversations with pending followups (current state, not date-specific)
    const pendingFollowupsToday = await this.prisma.conversation.count({
      where: {
        orgId,
        followupTasks: {
          some: {
            status: 'PENDING',
          },
        },
      },
    });

    // Top 5 intents from conversations active on the selected date
    const conversationsForDate = await this.prisma.conversation.findMany({
      where: {
        orgId,
        OR: [
          {
            createdAt: {
              gte: targetDate,
              lt: nextDay,
            },
          },
          {
            lastMessageAt: {
              gte: targetDate,
              lt: nextDay,
            },
          },
        ],
        intent: { not: null },
      },
      select: {
        intent: true,
      },
    });

    // Count intents manually
    const intentMap = new Map<string, number>();
    conversationsForDate.forEach((conv) => {
      if (conv.intent) {
        intentMap.set(conv.intent, (intentMap.get(conv.intent) || 0) + 1);
      }
    });

    const topIntents = Array.from(intentMap.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      date: targetDate.toISOString(),
      totalConversationsToday,
      newConversationsToday,
      totalMessagesFromCustomersToday,
      totalMessagesFromBiztaToday,
      conversationsNeedingHuman,
      pendingFollowupsToday,
      topIntents,
    };
  }

  /**
   * Get paginated list of conversations with filters
   */
  async getConversations(
    orgId: string,
    page: number = 1,
    pageSize: number = 20,
    intent?: ConversationIntent,
    requiresHuman?: boolean,
    hotOnly?: boolean,
  ): Promise<ConversationListResponseDto> {
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.ConversationWhereInput = {
      orgId,
    };

    if (intent) {
      where.intent = intent;
    }

    if (requiresHuman !== undefined) {
      where.requiresHuman = requiresHuman;
    }

    if (hotOnly) {
      where.leadScore = {
        gte: 80,
      };
    }

    // Get total count
    const total = await this.prisma.conversation.count({ where });

    // Get conversations with pending followup info
    const conversations = await this.prisma.conversation.findMany({
      where,
      select: {
        id: true,
        customerPhone: true,
        customerName: true,
        lastMessageAt: true,
        createdAt: true,
        intent: true,
        subIntent: true,
        leadScore: true,
        requiresHuman: true,
        followupTasks: {
          where: {
            status: 'PENDING',
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    const items = conversations.map((conv) => ({
      id: conv.id,
      customerPhone: conv.customerPhone || 'Unknown',
      customerName: conv.customerName,
      lastMessageAt:
        (conv.lastMessageAt || conv.createdAt)?.toISOString() || new Date().toISOString(),
      intent: conv.intent,
      subIntent: conv.subIntent,
      leadScore: conv.leadScore,
      requiresHuman: conv.requiresHuman ?? false,
      channel: 'whatsapp' as const,
      hasPendingFollowup: conv.followupTasks.length > 0,
    }));

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  /**
   * Get conversation detail with messages
   */
  async getConversationDetail(
    orgId: string,
    conversationId: string,
  ): Promise<ConversationDetailDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 100, // Last 100 messages
          select: {
            id: true,
            direction: true,
            content: true,
            createdAt: true,
            metadata: true,
          },
        },
        followupTasks: {
          where: {
            status: 'PENDING',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            scheduledAt: true,
          },
        },
      },
    });

    if (!conversation || !conversation.customerPhone) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // Get last sent followup
    const lastSentFollowup = await this.prisma.followupTask.findFirst({
      where: {
        conversationId,
        status: 'SENT',
      },
      orderBy: {
        sentAt: 'desc',
      },
      select: {
        sentAt: true,
      },
    });

    const messages = conversation.messages.map((msg) => {
      const metadata = msg.metadata as { handledBy?: string } | null;
      const handledBy = metadata?.handledBy;

      return {
        id: msg.id,
        direction: msg.direction,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        handledBy: (handledBy === 'AI' || handledBy === 'HUMAN' || handledBy === 'SYSTEM'
          ? handledBy
          : null) as 'AI' | 'HUMAN' | 'SYSTEM' | null,
      };
    });

    return {
      id: conversation.id,
      customerPhone: conversation.customerPhone,
      customerName: conversation.customerName,
      intent: conversation.intent,
      subIntent: conversation.subIntent,
      leadScore: conversation.leadScore,
      requiresHuman: conversation.requiresHuman ?? false,
      inHumanHandling: conversation.inHumanHandling, // Task 10
      channel: 'whatsapp',
      createdAt: conversation.createdAt.toISOString(),
      lastMessageAt:
        conversation.lastMessageAt?.toISOString() || conversation.createdAt.toISOString(),
      followup: {
        hasPending: conversation.followupTasks.length > 0,
        nextScheduledAt: conversation.followupTasks[0]?.scheduledAt?.toISOString() || null,
        lastSentAt: lastSentFollowup?.sentAt?.toISOString() || null,
      },
      messages,
    };
  }

  /**
   * Send a manual reply as human
   */
  async sendReply(
    orgId: string,
    conversationId: string,
    messageContent: string,
  ): Promise<ReplyResponseDto> {
    // Verify conversation belongs to org
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
      select: {
        id: true,
        customerPhone: true,
        channelId: true,
      },
    });

    if (!conversation || !conversation.customerPhone) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    this.logger.log(
      `Sending human reply to ${conversation.customerPhone} in conversation ${conversationId}`,
    );

    // Send via WhatsApp
    await this.messaging.sendWhatsAppText({
      to: conversation.customerPhone,
      text: messageContent,
      orgId,
      metadata: {
        conversationId,
        handledBy: 'HUMAN',
      },
    });

    // Store message in DB
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        orgId,
        channelId: conversation.channelId,
        direction: 'OUTBOUND',
        content: messageContent,
        metadata: {
          handledBy: 'HUMAN',
        } as Prisma.JsonObject,
      },
    });

    // Update conversation lastMessageAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        // Task 10: Auto-enable human handoff when human replies
        inHumanHandling: true,
        requiresHuman: true,
      },
    });

    // Optionally cancel pending followups since human took over
    await this.prisma.followupTask.updateMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    this.logger.log(
      `Human reply sent successfully, message ID: ${message.id}, inHumanHandling=true`,
    );

    return {
      id: message.id,
      direction: 'OUTBOUND',
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      handledBy: 'HUMAN',
    };
  }

  /**
   * Task 10: Take over a conversation as human (pause AI)
   */
  async takeoverConversation(orgId: string, conversationId: string) {
    this.logger.log(`[TAKEOVER] Human taking over conversation: ${conversationId}`);

    // Verify conversation belongs to org
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Set inHumanHandling flag
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        inHumanHandling: true,
        requiresHuman: true, // Mark as requiring human attention
      },
    });

    // Cancel pending followups
    await this.prisma.followupTask.updateMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    this.logger.log(
      `[TAKEOVER] AI paused for conversation ${conversationId}, inHumanHandling=true`,
    );

    return {
      id: updated.id,
      inHumanHandling: updated.inHumanHandling,
      requiresHuman: updated.requiresHuman,
    };
  }

  /**
   * Task 10: Release conversation back to AI
   */
  async releaseConversation(orgId: string, conversationId: string) {
    this.logger.log(`[RELEASE] Releasing conversation to AI: ${conversationId}`);

    // Verify conversation belongs to org
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Clear inHumanHandling flag
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        inHumanHandling: false,
        requiresHuman: false, // AI can handle it now
      },
    });

    this.logger.log(
      `[RELEASE] AI resumed for conversation ${conversationId}, inHumanHandling=false`,
    );

    return {
      id: updated.id,
      inHumanHandling: updated.inHumanHandling,
      requiresHuman: updated.requiresHuman,
    };
  }

  /**
   * Cancel pending followup for a conversation
   */
  async cancelFollowup(
    orgId: string,
    conversationId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`[FOLLOWUP] Cancelling followup for conversation: ${conversationId}`);

    // Verify conversation belongs to org
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Cancel all pending followups
    const result = await this.prisma.followupTask.updateMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    this.logger.log(`[FOLLOWUP] Cancelled ${result.count} pending followup(s)`);

    return {
      success: true,
      message:
        result.count > 0
          ? `Cancelled ${result.count} pending followup(s)`
          : 'No pending followups to cancel',
    };
  }

  /**
   * Schedule a new followup for a conversation
   */
  async scheduleFollowup(
    orgId: string,
    conversationId: string,
    delayHours: number = 24,
  ): Promise<{ success: boolean; message: string; scheduledAt: string }> {
    this.logger.log(
      `[FOLLOWUP] Scheduling followup for conversation: ${conversationId} (delay: ${delayHours}h)`,
    );

    // Verify conversation belongs to org
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
      select: {
        id: true,
        channelId: true,
        channel: {
          select: {
            type: true,
          },
        },
        customerPhone: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Cancel any existing pending followups first
    await this.prisma.followupTask.updateMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // Schedule new followup
    const scheduledAt = new Date();
    scheduledAt.setHours(scheduledAt.getHours() + delayHours);

    // Map ChannelType to FollowupChannel (default to WHATSAPP for unsupported channels)
    let followupChannel: 'WHATSAPP' | 'WEBCHAT' | 'EMAIL' = 'WHATSAPP';
    if (conversation.channel.type === 'WEBCHAT') {
      followupChannel = 'WEBCHAT';
    } else if (conversation.channel.type === 'EMAIL') {
      followupChannel = 'EMAIL';
    }

    const followup = await this.prisma.followupTask.create({
      data: {
        conversationId,
        orgId,
        customerPhone: conversation.customerPhone || '',
        channel: followupChannel,
        type: 'CUSTOMER_REMINDER',
        scheduledAt,
        status: 'PENDING',
        messageTemplate: `Follow-up reminder scheduled by human agent for ${delayHours} hours from now.`,
      },
    });

    this.logger.log(
      `[FOLLOWUP] Scheduled new followup: ${followup.id} at ${scheduledAt.toISOString()}`,
    );

    return {
      success: true,
      message: `Followup scheduled for ${delayHours} hours from now`,
      scheduledAt: scheduledAt.toISOString(),
    };
  }
}
