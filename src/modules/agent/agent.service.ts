import { Injectable, Logger } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process event - Agent orchestrator entry point
   * This is a stub implementation for Task 3
   * Will be expanded in Task 4 with AI decision-making
   */
  async processEvent(event: Event): Promise<void> {
    this.logger.log(`🤖 Agent received event ${event.id} (${event.type})`);

    // Load organization settings
    const settings = await this.prisma.settings.findUnique({
      where: { orgId: event.orgId },
    });

    if (!settings) {
      this.logger.warn(`No settings found for org ${event.orgId}`);
      return;
    }

    this.logger.debug(
      `Org settings loaded: autoReply=${settings.autoReply}, agentName=${settings.agentName}`,
    );

    // Log event details
    this.logger.log(`Event payload: ${JSON.stringify(event.payload, null, 2)}`);

    // TODO (Task 4): Implement actual agent logic
    // 1. Load conversation context
    // 2. Call LLM with tool schemas (skills)
    // 3. Execute decided skill (e.g., MessagingSkill.reply)
    // 4. Create AgentAction record
    // 5. Handle followups, escalations, etc.

    this.logger.log(`✅ Agent stub completed for event ${event.id} - No action taken yet`);
  }
}
