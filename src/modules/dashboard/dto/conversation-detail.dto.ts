import { ConversationIntent, MessageDirection } from '@prisma/client';

export class MessageDto {
  id: string;
  direction: MessageDirection;
  content: string;
  createdAt: string;
  handledBy?: 'AI' | 'HUMAN' | 'SYSTEM' | null;
}

export class FollowupInfoDto {
  hasPending: boolean;
  nextScheduledAt?: string | null;
  lastSentAt?: string | null;
}

export class ConversationDetailDto {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  intent?: ConversationIntent | null;
  subIntent?: string | null;
  leadScore?: number | null;
  requiresHuman: boolean;
  channel: 'whatsapp';
  createdAt: string;
  lastMessageAt: string;
  followup: FollowupInfoDto;
  messages: MessageDto[];
}
