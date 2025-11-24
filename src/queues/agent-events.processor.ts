import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentEventJob, AGENT_EVENTS_QUEUE } from './agent-events.queue';
import { AgentService } from '@/modules/agent/agent.service';
import { EventsService } from '@/modules/events/events.service';
import { EventStatus } from '@prisma/client';

@Processor(AGENT_EVENTS_QUEUE)
export class AgentEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentEventsProcessor.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly eventsService: EventsService,
  ) {
    super();
  }

  async process(job: Job<AgentEventJob>): Promise<void> {
    const { eventId, orgId, type } = job.data;

    this.logger.log(`Processing event ${eventId} (${type}) for org ${orgId}`);

    try {
      // Update event status to PROCESSING
      await this.eventsService.updateEventStatus(eventId, EventStatus.PROCESSING);

      // Load full event from database
      const event = await this.eventsService.findById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      // Delegate to agent orchestrator
      await this.agentService.processEvent(event);

      // Update event status to COMPLETED
      await this.eventsService.updateEventStatus(eventId, EventStatus.COMPLETED);

      this.logger.log(`✅ Event ${eventId} processed successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to process event ${eventId}: ${error.message}`, error.stack);

      // Update event status to FAILED
      await this.eventsService.updateEventStatus(eventId, EventStatus.FAILED, error.message);

      throw error; // Re-throw for BullMQ retry mechanism
    }
  }
}
