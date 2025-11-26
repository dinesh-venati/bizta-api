import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Message, Prisma, MessageDirection, MessageStatus } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new message in a conversation
   * @param params - Message creation parameters
   * @returns The created message
   */
  async create(params: {
    conversationId: string;
    orgId: string;
    direction: 'inbound' | 'outbound';
    content: string;
    rawPayload?: Prisma.JsonValue;
    externalId?: string;
  }): Promise<Message> {
    const { conversationId, orgId, direction, content, rawPayload, externalId } = params;

    // Get conversation to find channelId
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { channelId: true },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        orgId,
        channelId: conversation.channelId,
        direction: direction === 'inbound' ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
        content,
        ...(rawPayload && { metadata: rawPayload }),
        externalId: externalId || null,
        status: MessageStatus.SENT, // Default status
      },
    });
  }

  /**
   * Find messages by conversation ID
   * @param conversationId - Conversation ID
   * @param limit - Maximum number of messages to return
   * @returns Array of messages
   */
  async findByConversationId(conversationId: string, limit = 50): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update message status
   * @param id - Message ID
   * @param status - New status
   * @returns Updated message
   */
  async updateStatus(id: string, status: MessageStatus): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Find a message by external ID
   * @param externalId - External message ID
   * @returns The message or null if not found
   */
  async findByExternalId(externalId: string): Promise<Message | null> {
    return this.prisma.message.findFirst({
      where: { externalId },
    });
  }
}
