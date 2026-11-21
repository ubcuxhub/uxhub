import type { CheckInAttendee, CheckInResult } from "@/features/admin/types";

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
/** Only root-relative internal destinations are accepted, including after URL decoding. */
export function checkInReturnTo(value?: string): string {
  if (!value) return "/admin/events";
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || (decoded.includes("\\") || Array.from(decoded).some(char => char.charCodeAt(0) <= 32))) return "/admin/events";
    const url = new URL(value, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid" || url.pathname.startsWith("//") || url.pathname.includes("/check-in")) return "/admin/events";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/admin/events"; }
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
