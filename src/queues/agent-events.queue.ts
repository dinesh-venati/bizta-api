import { EventType } from '@prisma/client';

export interface AgentEventJob {
  eventId: string;
  orgId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export const AGENT_EVENTS_QUEUE = 'agent-events';
