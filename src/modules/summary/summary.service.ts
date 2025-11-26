import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DailyStats } from './interfaces/daily-stats.interface';
import {
  MessageDirection,
  FollowupStatus,
  ConversationStatus,
} from '@prisma/client';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get daily statistics for an organization
   * @param orgId - Organization ID
   * @param date - Date to compute stats for (defaults to today)
   * @returns DailyStats object with aggregated metrics
   */
  async getDailyStatsForOrg(
    orgId: string,
    date: Date = new Date(),
  ): Promise<DailyStats> {
    // Calculate start and end of day in UTC
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    this.logger.debug(
      `Computing daily stats for org ${orgId} from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`,
    );

    // Total conversations (active during the day)
    const totalConversationsToday = await this.prisma.conversation.count({
      where: {
        orgId,
        OR: [
          {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          {
            lastMessageAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
    });

    // New conversations created today
    const newConversationsToday = await this.prisma.conversation.count({
      where: {
        orgId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Messages from customers (INBOUND)
    const totalMessagesFromCustomersToday = await this.prisma.message.count({
      where: {
        orgId,
        direction: MessageDirection.INBOUND,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Messages from Bizta (OUTBOUND)
    const totalMessagesFromBiztaToday = await this.prisma.message.count({
      where: {
        orgId,
        direction: MessageDirection.OUTBOUND,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Followups scheduled today
    const followupsScheduledToday = await this.prisma.followupTask.count({
      where: {
        orgId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Followups sent today
    const followupsSentToday = await this.prisma.followupTask.count({
      where: {
        orgId,
        status: FollowupStatus.SENT,
        sentAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Conversations needing human attention
    // Definition: OPEN conversations with last customer message > 2 hours ago and no Bizta reply after that
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const openConversations = await this.prisma.conversation.findMany({
      where: {
        orgId,
        status: ConversationStatus.OPEN,
        lastMessageAt: {
          lte: twoHoursAgo,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Count conversations where last message was from customer (INBOUND)
    const conversationsNeedingHuman = openConversations.filter(
      (conv) =>
        conv.messages.length > 0 &&
        conv.messages[0].direction === MessageDirection.INBOUND,
    ).length;

    const stats: DailyStats = {
      date,
      totalConversationsToday,
      newConversationsToday,
      totalMessagesFromCustomersToday,
      totalMessagesFromBiztaToday,
      followupsScheduledToday,
      followupsSentToday,
      conversationsNeedingHuman,
    };

    this.logger.debug(`Daily stats for org ${orgId}:`, stats);

    return stats;
  }
}
