/**
 * Single source of truth for Supabase table names.
 *
 * Reference these constants from query helpers AND from places the query
 * builder cannot type-check, such as realtime `postgres_changes`
 * subscriptions. A table rename then becomes a one-line edit here.
 */
export const TABLES = {
  appSettings: "app_settings",
  events: "events",
  adminEventDrafts: "admin_event_drafts",
  userInfo: "user_info",
  eventTickets: "event_tickets",
  eventApplications: "event_applications",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  mentors: "mentors",
  sponsors: "sponsors",
  eventMentors: "event_mentors",
  eventPeopleSections: "event_people_sections",
  eventSponsors: "event_sponsors",
  membershipTypes: "membership_types",
  purchases: "purchases",
  squareWebhookEvents: "square_webhook_events",
  eventAgendaDays: "event_agenda_days",
  eventAgendaItems: "event_agenda_items",
  teams: "teams",
  teamMembers: "team_members",
  eventLinks: "event_links",
  eventPrivateDetails: "event_private_details",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
