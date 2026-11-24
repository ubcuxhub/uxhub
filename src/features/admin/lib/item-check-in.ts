import type { CheckInAttendee, CheckInResult } from "@/features/admin/types";
import { getSafeInternalPath } from "@/lib/auth/paths";

export interface CheckInItem {
  id: string;
  label: string;
  starts_at: string | null;
  ends_at: string | null;
}
export interface ItemAttendance {
  ticketId: string;
  attendanceVersion: string;
  checkedInAt: string;
  operator: string | null;
  method: "scan" | "manual" | null;
}
export interface ItemCheckInSnapshot {
  refreshedAt?: string;
  /** The selected item's check-in session, whose `check_ins` the screen listens to. */
  sessionId?: string | null;
  items: CheckInItem[];
  attendees: CheckInAttendee[];
  attendance: ItemAttendance[];
}
export type ItemCheckInResult = Exclude<CheckInResult, { status: "checked_in" | "already_checked_in"; }> |
{ status: "checked_in" | "already_checked_in"; name: string; ticketId: string; attendanceVersion: string; checkedInAt: string; checkedCount: number; total: number; };

/** Explicit invalid links stay unselected. Times choose a default, never gate writes. */
export function selectedCheckInItem(items: CheckInItem[], explicit: string | undefined, now: Date): string | null {
  if (explicit !== undefined)
    return items.some(item => item.id === explicit) ? explicit : null;
  const sorted = [...items].sort((a, b) => (a.starts_at ?? "\uffff").localeCompare(b.starts_at ?? "\uffff") || a.id.localeCompare(b.id));
  const at = now.getTime();
  return (sorted.find(item => item.starts_at && item.ends_at && Date.parse(item.starts_at) <= at && at <= Date.parse(item.ends_at))
    ?? sorted.find(item => item.starts_at && Date.parse(item.starts_at) > at)
    ?? sorted.at(-1))?.id ?? null;
}
/** A safe internal destination (`getSafeInternalPath`) that isn't a check-in page itself. */
export function checkInReturnTo(value?: string): string {
  const fallback = "/admin/events";
  const path = getSafeInternalPath(value, fallback);
  return path.split(/[?#]/, 1)[0].includes("/check-in") ? fallback : path;
}
export function checkInBackLabel(returnTo: string): string {
  const path = returnTo.split(/[?#]/)[0];
  if (path.endsWith("/agenda")) return "Back to Agenda";
  if (path === "/admin/events") return "Back to Manage Events";
  if (/^\/admin\/events\/[^/]+$/.test(path)) return "Back to Event overview";
  if (/^\/admin\/events\/[^/]+\/overview$/.test(path)) return "Back to Overview";
  return "Back to previous page";
}
export function checkInPath(eventId: string, itemId: string | null, scan = false, returnTo?: string) {
  const base = `/admin/events/${eventId}/check-in${scan ? "/scan" : ""}`;
  const query = new URLSearchParams();
  if (itemId !== null) query.set("item", itemId);
  if (returnTo !== undefined) query.set("returnTo", checkInReturnTo(returnTo));
  return query.size ? `${base}?${query}` : base;
}
