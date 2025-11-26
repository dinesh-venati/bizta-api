import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FollowupChannel, FollowupType, FollowupStatus } from '@prisma/client';

export interface ScheduleCustomerFollowupParams {
  orgId: string;
  conversationId: string;
  customerPhone: string;
  channel: 'whatsapp';
  delayHours: number;
  messageTemplate?: string;
}

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('followup-jobs') private followupQueue: Queue,
  ) {}

  async scheduleCustomerFollowup(params: ScheduleCustomerFollowupParams) {
    const { orgId, conversationId, customerPhone, channel, delayHours, messageTemplate } = params;

    // Check if there's already a PENDING followup for this conversation
    const existingPending = await this.prisma.followupTask.findFirst({
      where: {
        conversationId,
        status: FollowupStatus.PENDING,
      },
    });

    if (existingPending) {
      this.logger.debug(`Followup already scheduled for conversation ${conversationId}, skipping`);
      return existingPending;
    }

    // Get org settings for default message template
    const settings = await this.prisma.settings.findUnique({
      where: { orgId },
    });

    const defaultTemplate =
      "Hi, just checking in 🙂 let me know if you'd like to continue or have any questions.";
    const finalTemplate = messageTemplate || settings?.followupMessageTemplate || defaultTemplate;

    // Calculate scheduled time
    const scheduledAt = new Date();
    scheduledAt.setTime(scheduledAt.getTime() + delayHours * 60 * 60 * 1000);

    // Create FollowupTask
    const followupTask = await this.prisma.followupTask.create({
      data: {
        orgId,
        conversationId,
        customerPhone,
        channel: channel.toUpperCase() as FollowupChannel,
        type: FollowupType.CUSTOMER_REMINDER,
        status: FollowupStatus.PENDING,
        scheduledAt,
        messageTemplate: finalTemplate,
      },
    });

    this.logger.log(
      `📅 Scheduled followup ${followupTask.id} for ${customerPhone} at ${scheduledAt.toISOString()}`,
    );

    // Enqueue job to run at scheduledAt
    const delayMs = scheduledAt.getTime() - Date.now();
    await this.followupQueue.add(
      'process-followup',
      {
        followupTaskId: followupTask.id,
        orgId,
      },
      {
        delay: delayMs > 0 ? delayMs : 0,
        jobId: followupTask.id, // Use task ID as job ID for idempotency
      },
    );

    this.logger.debug(`Enqueued followup job ${followupTask.id} with delay ${delayMs}ms`);

    return followupTask;
  }

  async cancelFollowupForConversation(conversationId: string) {
    const updated = await this.prisma.followupTask.updateMany({
      where: {
        conversationId,
        status: FollowupStatus.PENDING,
      },
      data: {
        status: FollowupStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    if (updated.count > 0) {
      this.logger.log(
        `Cancelled ${updated.count} pending followup(s) for conversation ${conversationId}`,
      );
    }

    return updated.count;
  }

  async getTaskById(id: string) {
    return this.prisma.followupTask.findUnique({
      where: { id },
      include: {
        conversation: true,
        organization: {
          include: {
            settings: true,
          },
        },
      },
    });
  }

  async updateTaskStatus(id: string, status: FollowupStatus, sentAt?: Date, error?: string) {
    return this.prisma.followupTask.update({
      where: { id },
      data: {
        status,
        sentAt,
        updatedAt: new Date(),
        metadata: error
          ? {
              error,
            }
          : undefined,
      },
    });
  }
}
