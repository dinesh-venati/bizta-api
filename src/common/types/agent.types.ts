export interface BiztaEvent {
  id: string;
  type:
    | 'MESSAGE_RECEIVED'
    | 'MESSAGE_STATUS'
    | 'CONVERSATION_OPENED'
    | 'CONVERSATION_CLOSED'
    | 'SCHEDULED_FOLLOWUP'
    | 'DAILY_SUMMARY'
    | 'WEB_CHECK'
    | 'SYSTEM';
  orgId: string;
  channelId?: string;
  conversationId?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface LLMToolCall {
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  model: string;
  tokens: number;
}

export interface AgentContext {
  orgId: string;
  event: BiztaEvent;
  settings: Record<string, unknown>;
  conversation?: Record<string, unknown>;
  recentMessages?: Array<Record<string, unknown>>;
  memory?: Record<string, unknown>;
}
