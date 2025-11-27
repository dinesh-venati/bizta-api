export class TopIntentDto {
  intent: string;
  count: number;
}

export class DashboardSummaryDto {
  date: string;
  totalConversationsToday: number;
  newConversationsToday: number;
  totalMessagesFromCustomersToday: number;
  totalMessagesFromBiztaToday: number;
  conversationsNeedingHuman: number;
  pendingFollowupsToday: number;
  topIntents: TopIntentDto[];
}
