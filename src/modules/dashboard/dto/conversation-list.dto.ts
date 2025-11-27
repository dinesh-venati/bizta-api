import { ConversationIntent } from '@prisma/client';

export class ConversationListItemDto {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  lastMessageAt: string;
  intent?: ConversationIntent | null;
  subIntent?: string | null;
  leadScore?: number | null;
  requiresHuman: boolean;
  channel: 'whatsapp';
  hasPendingFollowup: boolean;
}

export class ConversationListResponseDto {
  items: ConversationListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}
