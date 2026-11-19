import { strictPacificTimestamp } from "@/lib/date";
import { websiteUrlError } from "./event-configuration";

import type { LocationDraft } from "@/lib/location";
export type { LocationDraft } from "@/lib/location";

export interface EventDateDraft {
  key: string;
  session_id: string | null;
  date: string;
  start: string;
  end: string;
  label: string;
  location: LocationDraft | null;
  items?: AgendaItemDraft[];
}

export interface AgendaItemDraft {
  key: string;
  session_id: string | null;
  label: string;
  start: string;
  end_date: string;
  end: string;
  description: string;
  location: LocationDraft | null;
  check_in: boolean;
  /** Loaded staff-only evidence; database guards never trust this flag. */
  attended?: boolean;
}

export interface EventDateLocationDraft {
  version?: 2;
  automatic: boolean;
  audience: "everyone" | "going";
  location: LocationDraft;
  dates: EventDateDraft[];
}

export const emptyLocation = (): LocationDraft => ({ type: "in_person", building: "", room: "", address: "", map_url: "", meeting_url: "", meeting_id: "", meeting_passcode: "", public_summary: "" });
export const emptyEventDate = (): EventDateDraft => ({ key: crypto.randomUUID(), session_id: null, date: "", start: "", end: "", label: "", location: null });
export const emptyAgendaItem = (date = ""): AgendaItemDraft => ({ key: crypto.randomUUID(), session_id: null, label: "", start: "", end_date: date, end: "", description: "", location: null, check_in: false });
export const emptyAgendaDay = (): EventDateDraft => ({ ...emptyEventDate(), location: emptyLocation(), items: [] });

/** Derived projections only: the editor never edits these day-level times. */
export function agendaProjection(value: EventDateLocationDraft): EventDateLocationDraft {
  if (value.version !== 2) return value;
  return { ...value, location: value.dates[0]?.location ?? emptyLocation(), dates: value.dates.map(day => {
    const items = day.items ?? [];
    const starts = items.filter(item => day.date && item.start).map(item => `${day.date}T${item.start}`).sort();
    const ends = items.filter(item => item.end_date && item.end).map(item => `${item.end_date}T${item.end}`).sort();
    return { ...day, start: starts[0]?.split("T")[1] ?? "", end: ends.at(-1)?.split("T")[1] ?? "" };
  }) };
}

export function agendaEnvelope(value: EventDateLocationDraft) {
  const ranges = value.version === 2
    ? value.dates.flatMap(day => (day.items ?? []).map(item => ({ start: day.date && item.start ? `${day.date}T${item.start}` : "", end: item.end_date && item.end ? `${item.end_date}T${item.end}` : "" })))
    : value.dates.map(day => ({ start: day.date && day.start ? `${day.date}T${day.start}` : "", end: day.date && day.end ? `${day.date}T${day.end}` : "" }));
  return { starts_at: ranges.map(row => row.start).filter(Boolean).sort()[0] ?? "", ends_at: ranges.map(row => row.end).filter(Boolean).sort().at(-1) ?? "" };
}

/** Structural validation permits incomplete drafts without accepting executable URLs. */
export function parseDateLocationDraft(input: unknown): EventDateLocationDraft {
  if (!input || typeof input !== "object") throw new Error("Invalid date and location settings.");
  const value = input as EventDateLocationDraft;
  const locationValid = (location: LocationDraft) => location && ["in_person", "online", "hybrid"].includes(location.type) &&
    [location.building, location.room, location.address, location.map_url, location.meeting_url, location.meeting_id, location.meeting_passcode, location.public_summary].every(item => typeof item === "string") &&
    [location.map_url, location.meeting_url].every(url => !/^[a-z][a-z0-9+.-]*:/i.test(url.trim()) || /^https?:/i.test(url.trim()));
  if (value.automatic !== true || !["everyone", "going"].includes(value.audience) || !locationValid(value.location) || !Array.isArray(value.dates) || value.dates.length > 100 || value.dates.some(row => !row || [row.key, row.date, row.start, row.end, row.label].some(item => typeof item !== "string") || !(row.session_id === null || typeof row.session_id === "string") || (row.location !== null && !locationValid(row.location)))) throw new Error("Invalid date and location settings.");
  if (new Set(value.dates.map(row => row.key)).size !== value.dates.length) throw new Error("Each date must have its own identity.");
  if (value.version !== undefined && value.version !== 2) throw new Error("Invalid agenda version.");
  if (value.version === 2) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const keys: string[] = [];
    for (const day of value.dates) {
      if (!uuid.test(day.key) || !day.location || !Array.isArray(day.items) || day.items.length > 500) throw new Error("Invalid agenda day.");
      keys.push(day.key);
      for (const item of day.items) {
        if (!item || !uuid.test(item.key) || [item.label, item.start, item.end_date, item.end, item.description].some(field => typeof field !== "string") || typeof item.check_in !== "boolean" || !(item.session_id === null || typeof item.session_id === "string") || (item.location !== null && !locationValid(item.location))) throw new Error("Invalid agenda item.");
        keys.push(item.key);
      }
    }
    if (new Set(keys).size !== keys.length) throw new Error("Each day and item needs its own identity.");
  }
  return value;
}

export interface DateLocationIssue {
  target: string;
  message: string;
  required: boolean;
  /** Stable existing action wording, independent of granular field feedback. */
  problem: string;
}

/** The editor, publication validator and server share these domain rules. */
export function dateLocationIssues(config: EventDateLocationDraft): DateLocationIssue[] {
  const issues: DateLocationIssue[] = [];
  const add = (target: string, message: string, required = false) => {
    const problem = config.version !== 2 && target.startsWith("date-") && required
      ? "Every date needs a valid date, start and end in Pacific time. Clock-transition times must be unambiguous."
      : message === "Building is required." || message === "Street address is required."
        ? "In-person locations require a building and street address."
        : message;
    issues.push({ target, message, required, problem });
  };
  if (config.automatic) {
    if (!config.dates.length) add("builder-agenda", "Add at least one event date.", true);
    for (const row of config.dates) {
      if (config.version === 2) {
        if (!row.label.trim()) add(`date-${row.key}-label`, "Day label is required.", true);
        if (!row.date) add(`date-${row.key}-date`, "Date is required.", true);
        if (row.date && config.dates.some(other => other.key !== row.key && other.date === row.date)) add(`date-${row.key}-date`, "Use one agenda day per calendar date.");
        if (!row.items?.length) add(`date-${row.key}-items`, "Add at least one agenda item to each day.", true);
        for (const item of row.items ?? []) {
          const target = `item-${item.key}`;
          if (!item.label.trim()) add(`${target}-label`, "Item label is required.", true);
          for (const [field, label] of [["start", "Starts"], ["end_date", "End date"], ["end", "Ends"]] as const) if (!item[field]) add(`${target}-${field}`, `${label} is required.`, true);
          const start = strictPacificTimestamp(`${row.date}T${item.start}`);
          const end = strictPacificTimestamp(`${item.end_date}T${item.end}`);
          if (row.date && item.start && !start) add(`${target}-start`, "Use an unambiguous, valid Pacific time.");
          if (item.end_date && item.end && !end) add(`${target}-end`, "Use an unambiguous, valid Pacific time.");
          if (start && end && end <= start) add(`${target}-end`, "Item end must be after its start.");
        }
        continue;
      }
      for (const [key, label] of [["date", "Date"], ["start", "Starts"], ["end", "Ends"]] as const) {
        if (!row[key]) add(`date-${row.key}-${key}`, `${label} is required.`, true);
      }
      if (row.date && row.start && row.end) {
        const start = strictPacificTimestamp(`${row.date}T${row.start}`);
        const end = strictPacificTimestamp(`${row.date}T${row.end}`);
        if (!start || !end) add(`date-${row.key}-date`, "Every date needs a valid date, start and end in Pacific time. Clock-transition times must be unambiguous.");
        else if (start >= end) add(`date-${row.key}-end`, "Event end time must be after the start time.");
      }
    }
  }
  const locations = config.version === 2
    ? config.dates.flatMap(day => [[day.key, day.location!] as const, ...(day.items ?? []).filter(item => item.location).map(item => [item.key, item.location!] as const)])
    : [["default", config.location] as const, ...config.dates.filter(row => row.location).map(row => [row.key, row.location!] as const)];
  for (const [key, location] of locations) {
    const loc = (field: string, message: string, required = false) => add(`location-${key}-${field}`, message, required);
    if (location.type !== "online" && location.map_url && websiteUrlError(location.map_url)) loc("map_url", "Enter valid HTTP or HTTPS location links.");
    if (location.type !== "in_person" && location.meeting_url && websiteUrlError(location.meeting_url)) loc("meeting_url", "Enter valid HTTP or HTTPS location links.");
    if (location.type !== "online") {
      if (!location.building.trim()) loc("building", "Building is required.", true);
      if (!location.address.trim()) loc("address", "Street address is required.", true);
    }
    if (location.type !== "in_person") {
      if (!location.meeting_url.trim()) loc("meeting_url", "Online locations require a meeting link.", true);
    }
    if (config.audience === "going" && !location.public_summary.trim()) loc("public_summary", "Add a public location summary for each restricted location.", true);
  }
  return issues;
}

export function dateLocationProblem(value: EventDateLocationDraft): string | null {
  return dateLocationIssues(value)[0]?.problem ?? null;
}

export function dateSessions(value: EventDateLocationDraft) {
  if (value.version === 2) return value.dates.flatMap(day => (day.items ?? []).filter(item => item.check_in).map(item => ({ id: item.session_id, name: item.label, start_time: strictPacificTimestamp(`${day.date}T${item.start}`)!, end_time: strictPacificTimestamp(`${item.end_date}T${item.end}`)! })));
  return value.dates.map(row => ({ id: row.session_id, name: row.label || row.date, start_time: strictPacificTimestamp(`${row.date}T${row.start}`)!, end_time: strictPacificTimestamp(`${row.date}T${row.end}`)! }));
}

/** Canonical session identities returned by the atomic save, in check-in order. */
export function withAgendaSessionIds(value: EventDateLocationDraft, ids: string[]): EventDateLocationDraft {
  let index = 0;
  return { ...value, dates: value.dates.map(day => value.version === 2
    ? { ...day, items: day.items?.map(item => ({ ...item, session_id: item.check_in ? ids[index++] ?? item.session_id : null })) }
    : { ...day, session_id: ids[index++] ?? day.session_id }) };
}

/** Recover earlier incomplete working documents into the unified editor. */
export function asAgenda(value: EventDateLocationDraft): EventDateLocationDraft {
  if (value.version === 2) return value;
  return agendaProjection({ ...value, version: 2, dates: value.dates.map(day => ({
    ...day, key: crypto.randomUUID(), location: day.location ?? { ...value.location },
    items: [{ ...emptyAgendaItem(day.date), session_id: day.session_id, label: day.label, start: day.start, end: day.end, check_in: true }],
  })) });
}
