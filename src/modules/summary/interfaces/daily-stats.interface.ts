export interface DailyStats {
  date: Date;
  totalConversationsToday: number;
  newConversationsToday: number;
  totalMessagesFromCustomersToday: number;
  totalMessagesFromBiztaToday: number;
  followupsScheduledToday: number;
  followupsSentToday: number;
  conversationsNeedingHuman: number;
}
