import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Conversation,
  ConversationStatus,
  ConversationIntent,
  MessageDirection,
} from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find or create a conversation by contact info
   * @param orgId - Organization ID
   * @param channelType - Channel type (e.g., 'whatsapp')
   * @param customerPhone - Customer phone number
   * @param externalId - External conversation ID (optional)
   * @param customerName - Customer name (optional)
   * @returns The existing or newly created conversation
   */
  async findOrCreateByContact(params: {
    orgId: string;
    channelType: string;
    customerPhone: string;
    externalId?: string;
    customerName?: string;
  }): Promise<Conversation> {
    const { orgId, channelType, customerPhone, externalId, customerName } = params;

    // Find or create channel for this organization
    let channel = await this.prisma.channel.findFirst({
      where: {
        orgId,
        type: channelType.toUpperCase() as 'WHATSAPP' | 'WEBCHAT' | 'EMAIL',
      },
    });

    if (!channel) {
      // Create channel if it doesn't exist
      channel = await this.prisma.channel.create({
        data: {
          orgId,
          type: channelType.toUpperCase() as 'WHATSAPP' | 'WEBCHAT' | 'EMAIL',
          name: `${channelType.charAt(0).toUpperCase() + channelType.slice(1)} Channel`,
          status: 'ACTIVE',
        },
      });
    }

    // Try to find existing conversation
    const existing = await this.prisma.conversation.findFirst({
      where: {
        orgId,
        channelId: channel.id,
        customerPhone,
      },
      orderBy: {
        createdAt: 'desc', // Get most recent conversation if multiple exist
      },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation if not found
    return this.prisma.conversation.create({
      data: {
        orgId,
        channelId: channel.id,
        customerPhone,
        customerName: customerName || null,
        externalId: externalId || null,
        status: ConversationStatus.OPEN,
      },
    });
  }

  /**
   * Find a conversation by ID
   * @param id - Conversation ID
   * @returns The conversation or null if not found
   */
  async findById(id: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
    });
  }

  /**
   * Update conversation status
   * @param id - Conversation ID
   * @param status - New status
   * @returns Updated conversation
   */
  async updateStatus(id: string, status: ConversationStatus): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update conversation classification (Task 7)
   */
  async updateClassification(params: {
    conversationId: string;
    intent?: ConversationIntent;
    subIntent?: string;
    leadScore?: number;
    requiresHuman?: boolean;
  }): Promise<Conversation> {
    const { conversationId, intent, subIntent, leadScore, requiresHuman } = params;

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        intent,
        subIntent,
        leadScore,
        requiresHuman,
      },
    });
  }

  /**
   * Get recent messages for conversation in simple format (Task 7)
   */
  async getRecentMessagesForConversation(
    conversationId: string,
    limit: number = 5,
  ): Promise<Array<{ from: 'customer' | 'bizta'; text: string }>> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        direction: true,
        content: true,
      },
    });

    // Reverse to get chronological order
    return messages.reverse().map((msg) => ({
      from: msg.direction === MessageDirection.INBOUND ? 'customer' : 'bizta',
      text: msg.content,
    }));
  }
}
