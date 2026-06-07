/**
 * Single source of truth for Supabase table names.
 *
 * Reference these constants from query helpers AND from places the query
 * builder cannot type-check, such as realtime `postgres_changes`
 * subscriptions. A table rename then becomes a one-line edit here.
 */
export const TABLES = {
  events: "events",
  userInfo: "user_info",
  eventRegistrations: "event_registrations",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  membershipTypes: "membership_types",
  purchases: "purchases",
  squareWebhookEvents: "square_webhook_events",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
