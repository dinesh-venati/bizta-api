import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SummaryService } from './summary.service';
import { LlmService } from '../llm/llm.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentActionType, AgentActionStatus, EventType } from '@prisma/client';

@Injectable()
export class SummaryScheduler {
  private readonly logger = new Logger(SummaryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly summary: SummaryService,
    private readonly llm: LlmService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Daily summary cron job
   * Runs every day at 21:30 UTC (configurable via DAILY_SUMMARY_CRON env var)
   */
  @Cron(process.env.DAILY_SUMMARY_CRON || '30 21 * * *', {
    timeZone: 'UTC',
  })
  async sendDailySummaries(): Promise<void> {
    this.logger.log('🔄 Starting daily summary job...');

    try {
      // Get all active organizations
      const organizations = await this.prisma.organization.findMany({
        where: {
          isActive: true,
        },
        include: {
          settings: true,
          memberships: {
            where: {
              role: 'OWNER',
            },
            include: {
              user: true,
            },
            take: 1,
          },
        },
      });

      this.logger.log(`Found ${organizations.length} active organization(s)`);

      let successCount = 0;
      let errorCount = 0;

      // Process each organization
      for (const org of organizations) {
        try {
          await this.processDailySummaryForOrg(org);
          successCount++;
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Failed to process daily summary for org ${org.id} (${org.name}): ${error.message}`,
            error.stack,
          );
          // Continue with next org
        }
      }

      this.logger.log(
        `✅ Daily summary job completed: ${successCount} succeeded, ${errorCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Failed to run daily summary job: ${error.message}`, error.stack);
    }
  }

  /**
   * Process daily summary for a single organization
   * Can be called manually for testing
   */
  async processDailySummaryForOrg(org: {
    id: string;
    name: string;
    settings: { dailySummaryEnabled: boolean; dailySummaryEmail: string | null } | null;
    memberships: Array<{ user: { email: string } }>;
  }): Promise<void> {
    const { id: orgId, name: orgName, settings, memberships } = org;

    this.logger.log(`Processing daily summary for org ${orgId} (${orgName})`);

    // Check if daily summary is enabled
    if (!settings?.dailySummaryEnabled) {
      this.logger.debug(`Daily summary disabled for org ${orgId}, skipping`);
      return;
    }

    // Get owner email
    const owner = memberships?.[0]?.user;
    if (!owner || !owner.email) {
      this.logger.warn(`No owner found for org ${orgId}, skipping summary`);
      return;
    }

    const recipientEmail = settings.dailySummaryEmail || owner.email;

    // Get today's date
    const today = new Date();

    // Compute daily stats
    this.logger.debug(`Computing stats for org ${orgId}...`);
    const stats = await this.summary.getDailyStatsForOrg(orgId, today);

    // Generate summary using LLM
    this.logger.debug(`Generating LLM summary for org ${orgId}...`);
    const summaryText = await this.llm.generateDailySummary({
      orgName,
      date: today,
      stats,
    });

    // Send email
    this.logger.debug(`Sending email to ${recipientEmail}...`);
    await this.notifications.sendDailySummaryEmail({
      to: recipientEmail,
      orgName,
      date: today,
      summaryText,
    });

    // Create Event
    const event = await this.prisma.event.create({
      data: {
        orgId,
        type: EventType.DAILY_SUMMARY,
        status: 'COMPLETED',
        payload: {
          date: today.toISOString(),
          stats: JSON.parse(JSON.stringify(stats)), // Convert to plain object
        },
      },
    });

    // Create AgentAction
    await this.prisma.agentAction.create({
      data: {
        orgId,
        eventId: event.id,
        type: AgentActionType.DAILY_SUMMARY_SENT,
        status: AgentActionStatus.COMPLETED,
        toolName: 'daily_summary',
        toolInput: {
          orgId,
          date: today.toISOString(),
        },
        toolOutput: {
          emailTo: recipientEmail,
          stats: JSON.parse(JSON.stringify(stats)), // Convert to plain object
          summaryLength: summaryText.length,
        },
      },
    });

    this.logger.log(`✅ Daily summary sent for org ${orgId} to ${recipientEmail}`);
  }

  /**
   * Manual trigger for testing (can be called from a controller)
   */
  async triggerManualSummary(orgId: string): Promise<void> {
    this.logger.log(`Manually triggering daily summary for org ${orgId}`);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        settings: true,
        memberships: {
          where: {
            role: 'OWNER',
          },
          include: {
            user: true,
          },
          take: 1,
        },
      },
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    await this.processDailySummaryForOrg(org);
  }
}
