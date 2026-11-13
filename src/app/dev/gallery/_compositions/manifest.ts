import type { CompositionMeta } from "./types";

/**
 * Every composition on the canvas, column by column, each column top to
 * bottom. Columns are balanced by hand: after adding one, check that the
 * columns still end at about the same height at 1440px.
 *
 * `uses` lists the registry slugs (`/dev/components/<slug>`) a composition
 * is built from. It is never rendered; `compositions.test.ts` checks every
 * slug exists and that the gallery covers the registry. The components live
 * beside this file, keyed by id.
 */
export const MANIFEST = [
  // Column 1: Student events and checkout
  {
    id: "event-registration",
    column: 1,
    uses: ["card", "status-badge", "avatar", "separator", "radio-group", "field", "checkbox", "button", "toast"],
  },
  {
    id: "featured-event",
    column: 1,
    uses: ["event-card", "status-badge"],
  },
  {
    id: "event-ticket",
    column: 1,
    uses: ["status-badge"],
  },
  {
    id: "checkout-summary",
    column: 1,
    uses: ["card", "detail-row", "field", "input", "button", "alert"],
  },
  {
    id: "toasts",
    column: 1,
    uses: ["toast", "button"],
  },
  {
    id: "no-events",
    column: 1,
    uses: ["empty-state", "hubbo", "button"],
  },
  // Column 2: Membership, tickets and settings
  {
    id: "membership-card",
    column: 2,
    uses: [],
  },
  {
    id: "membership-renewal",
    column: 2,
    uses: ["card", "action-banner", "field", "radio-group", "badge", "button"],
  },
  {
    id: "tickets",
    column: 2,
    uses: ["ticket"],
  },
  {
    id: "purchase-history",
    column: 2,
    uses: ["card", "transaction-row"],
  },
  {
    id: "member-perks",
    column: 2,
    uses: ["card", "copy-code", "separator"],
  },
  {
    id: "notification-settings",
    column: 2,
    uses: ["card", "switch", "segmented-toggle"],
  },
  // Column 3: Admin data, check-in and alerts
  {
    id: "admin-stats",
    column: 3,
    uses: ["stat-card"],
  },
  {
    id: "attendee-table",
    column: 3,
    uses: ["table", "table-toolbar", "search-field", "sort-filter-panel", "select", "filter-chip", "checkbox", "avatar", "status-badge", "pagination", "button"],
  },
  {
    id: "admin-event-header",
    column: 3,
    uses: ["card", "back-button", "badge", "button", "tab-nav"],
  },
  {
    id: "check-in",
    column: 3,
    uses: ["card", "alert", "search-field", "avatar", "status-badge", "button"],
  },
  {
    id: "mentors",
    column: 3,
    uses: ["list-row"],
  },
  {
    id: "loading",
    column: 3,
    uses: ["card", "skeleton", "spinner"],
  },
  {
    id: "alerts",
    column: 3,
    uses: ["alert"],
  },
  // Column 4: Applications and review (docs/design/application-review.md)
  {
    id: "applicant-header",
    column: 4,
    uses: ["card", "back-button", "avatar", "status-badge", "button", "tooltip"],
  },
  {
    id: "applicant",
    column: 4,
    uses: ["card", "badge", "status-badge"],
  },
  {
    id: "application-response",
    column: 4,
    uses: ["card"],
  },
  {
    id: "reviewer-notes",
    column: 4,
    uses: ["card", "avatar", "dropdown-menu", "icon-button", "confirm-dialog", "separator", "field", "textarea", "button"],
  },
  {
    id: "reviewer-notes-states",
    column: 4,
    uses: ["segmented-toggle", "card", "empty-state", "skeleton", "button"],
  },
  {
    id: "application-decision",
    column: 4,
    uses: ["card", "field", "input", "button", "spinner", "confirm-dialog", "success-overlay", "toast"],
  },
  {
    id: "application-form",
    column: 4,
    uses: ["card", "field", "input", "select", "textarea", "checkbox", "button", "status-badge", "toast"],
  },
  // Column 5: Event builder
  {
    id: "builder-basics",
    column: 5,
    uses: ["card", "field", "input", "textarea", "image-upload"],
  },
  {
    id: "builder-schedule",
    column: 5,
    uses: ["card", "field", "date-time-field", "slider", "switch"],
  },
  {
    id: "pickers",
    column: 5,
    uses: ["date-picker", "time-picker"],
  },
  {
    id: "event-colour",
    column: 5,
    uses: ["card", "colour-picker", "ticket"],
  },
  {
    id: "venue-and-judges",
    column: 5,
    uses: ["card", "searchable-dropdown", "field", "select"],
  },
  {
    id: "setup-outline",
    column: 5,
    uses: ["section-navigator"],
  },
  // Column 6: Navigation, overlays and event pages
  {
    id: "admin-shell",
    column: 6,
    uses: ["app-sidebar", "sidebar", "status-badge"],
  },
  {
    id: "event-actions",
    column: 6,
    uses: ["card", "dropdown-menu", "confirm-dialog", "icon-button", "button", "dialog", "field", "input", "sheet", "filter-chip", "side-peek-drawer", "record-drawer", "detail-row", "popover", "copy-code"],
  },
  {
    id: "registration-window",
    column: 6,
    uses: ["card", "calendar"],
  },
  {
    id: "profile",
    column: 6,
    uses: ["card", "avatar", "badge", "tooltip", "separator", "button", "icon-button"],
  },
  {
    id: "event-search",
    column: 6,
    uses: ["card", "segmented-toggle", "search-field", "empty-state", "hubbo", "button", "status-badge"],
  },
  {
    id: "agenda",
    column: 6,
    uses: ["card", "tabs", "separator"],
  },
  {
    id: "sponsors",
    column: 6,
    uses: ["card", "sponsor-logo-grid"],
  },
] as const satisfies readonly CompositionMeta[];

export type CompositionId = (typeof MANIFEST)[number]["id"];
