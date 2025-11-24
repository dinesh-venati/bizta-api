import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventType, EventStatus, Event } from '@prisma/client';

export interface CreateEventDto {
  orgId: string;
  type: EventType;
  payload: any;
  metadata?: any;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('agent-events') private readonly agentEventsQueue: Queue,
  ) {}

  /**
   * Create event and enqueue for agent processing
   */
  async createEvent(data: CreateEventDto): Promise<Event> {
    // Store event in database
    const event = await this.prisma.event.create({
      data: {
        type: data.type,
        status: EventStatus.PENDING,
        payload: data.payload,
        metadata: data.metadata || {},
        orgId: data.orgId,
      },
    });

    this.logger.log(`Created event ${event.id} (${event.type}) for org ${event.orgId}`);

    // Enqueue for agent processing
    await this.enqueueEvent(event);

    return event;
  }

  /**
   * Push event to agent-events queue
   */
  private async enqueueEvent(event: Event): Promise<void> {
    await this.agentEventsQueue.add(
      'process-event',
      {
        eventId: event.id,
        orgId: event.orgId,
        type: event.type,
        payload: event.payload,
      },
      {
        jobId: event.id,
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
      },
    );

    this.logger.debug(`Enqueued event ${event.id} to agent-events queue`);
  }

  /**
   * Update event status
   */
  async updateEventStatus(eventId: string, status: EventStatus, error?: string): Promise<Event> {
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        status,
        error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get event by ID
   */
  async findById(eventId: string): Promise<Event | null> {
    return this.prisma.event.findUnique({
      where: { id: eventId },
    });
  }

  /**
   * Get pending events (for recovery/retry)
   */
  async findPendingEvents(orgId?: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: {
        status: EventStatus.PENDING,
        ...(orgId && { orgId }),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}
