import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagingService } from '../modules/skills/messaging/messaging.service';
import { MessagesService } from '../modules/messages/messages.service';
import {
  FollowupStatus,
  MessageDirection,
  AgentActionType,
  AgentActionStatus,
  EventType,
} from '@prisma/client';

interface FollowupJobPayload {
  followupTaskId: string;
  orgId: string;
}

@Processor('followup-jobs')
export class FollowupJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowupJobsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private messagingService: MessagingService,
    private messagesService: MessagesService,
  ) {
    super();
  }

  async process(job: Job<FollowupJobPayload>): Promise<void> {
    const { followupTaskId, orgId } = job.data;

    this.logger.log(`⏰ Processing followup job ${followupTaskId} for org ${orgId}`);

    try {
      // Load FollowupTask
      const followupTask = await this.prisma.followupTask.findUnique({
        where: { id: followupTaskId },
        include: {
          conversation: true,
          organization: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (!followupTask) {
        this.logger.warn(`FollowupTask ${followupTaskId} not found, skipping`);
        return;
      }

      // Check if status is PENDING
      if (followupTask.status !== FollowupStatus.PENDING) {
        this.logger.debug(
          `FollowupTask ${followupTaskId} status is ${followupTask.status}, skipping`,
        );
        return;
      }

      // Check if autoFollowup is still enabled
      const settings = followupTask.organization.settings;
      if (!settings?.autoFollowup) {
        this.logger.log(
          `AutoFollowup disabled for org ${orgId}, cancelling task ${followupTaskId}`,
        );
        await this.prisma.followupTask.update({
          where: { id: followupTaskId },
          data: {
            status: FollowupStatus.CANCELLED,
            metadata: { reason: 'autoFollowup disabled' },
          },
        });
        return;
      }

      // Check if customer has replied since task was created
      const inboundMessagesSinceCreation = await this.prisma.message.findFirst({
        where: {
          conversationId: followupTask.conversationId,
          direction: MessageDirection.INBOUND,
          createdAt: {
            gt: followupTask.createdAt,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (inboundMessagesSinceCreation) {
        this.logger.log(
          `📩 Customer replied to conversation ${followupTask.conversationId}, cancelling followup ${followupTaskId}`,
        );
        await this.prisma.followupTask.update({
          where: { id: followupTaskId },
          data: {
            status: FollowupStatus.CANCELLED,
            metadata: {
              reason: 'customer replied',
              messageId: inboundMessagesSinceCreation.id,
            },
          },
        });
        return;
      }

      // All checks passed - send the followup message
      this.logger.log(`📤 Sending followup reminder to ${followupTask.customerPhone}`);

      // Send WhatsApp message
      const whatsappResponse = await this.messagingService.sendWhatsAppText({
        to: followupTask.customerPhone,
        text: followupTask.messageTemplate,
        orgId,
      });

      // Store outbound message
      const outboundMessage = await this.messagesService.create({
        orgId,
        conversationId: followupTask.conversationId,
        externalId: whatsappResponse.messageId,
        direction: 'outbound',
        content: followupTask.messageTemplate,
        rawPayload: {
          followupTaskId,
          whatsappResponse,
        },
      });

      this.logger.log(`✅ Followup message sent and stored: ${outboundMessage.id}`);

      // Create an Event for the followup (for audit trail)
      const event = await this.prisma.event.create({
        data: {
          orgId,
          type: EventType.SCHEDULED_FOLLOWUP,
          status: 'COMPLETED',
          payload: {
            followupTaskId,
            conversationId: followupTask.conversationId,
            customerPhone: followupTask.customerPhone,
          },
        },
      });

      // Create AgentAction
      await this.prisma.agentAction.create({
        data: {
          orgId,
          eventId: event.id,
          conversationId: followupTask.conversationId,
          type: AgentActionType.FOLLOWUP_SENT,
          status: AgentActionStatus.COMPLETED,
          toolName: 'followup_reminder',
          toolInput: {
            followupTaskId,
            customerPhone: followupTask.customerPhone,
            messageTemplate: followupTask.messageTemplate,
          },
          toolOutput: {
            messageId: outboundMessage.id,
            whatsappMessageId: whatsappResponse.messageId,
          },
        },
      });

      // Update FollowupTask status
      await this.prisma.followupTask.update({
        where: { id: followupTaskId },
        data: {
          status: FollowupStatus.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(`✅ Followup ${followupTaskId} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process followup ${followupTaskId}:`, error.stack);

      // Mark as FAILED
      await this.prisma.followupTask
        .update({
          where: { id: followupTaskId },
          data: {
            status: FollowupStatus.FAILED,
            metadata: {
              error: error.message,
              stack: error.stack,
            },
          },
        })
        .catch((updateError) => {
          this.logger.error(`Failed to update task status to FAILED:`, updateError);
        });

      // Re-throw to mark job as failed in BullMQ
      throw error;
    }
  }
}
