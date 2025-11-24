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
  payload: any;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface LLMToolCall {
  toolName: string;
  toolInput: any;
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
  settings: any;
  conversation?: any;
  recentMessages?: any[];
  memory?: Record<string, any>;
}
