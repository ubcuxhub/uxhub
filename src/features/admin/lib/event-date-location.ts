import { strictPacificTimestamp } from "@/lib/date";
import { websiteUrlError } from "./event-configuration";

export interface LocationDraft {
  type: "in_person" | "online" | "hybrid";
  building: string;
  room: string;
  address: string;
  map_url: string;
  meeting_url: string;
  meeting_id: string;
  meeting_passcode: string;
  public_summary: string;
}

export interface EventDateDraft {
  key: string;
  session_id: string | null;
  date: string;
  start: string;
  end: string;
  label: string;
  location: LocationDraft | null;
}

export interface EventDateLocationDraft {
  automatic: boolean;
  audience: "everyone" | "going";
  location: LocationDraft;
  dates: EventDateDraft[];
}

export const emptyLocation = (): LocationDraft => ({ type: "in_person", building: "", room: "", address: "", map_url: "", meeting_url: "", meeting_id: "", meeting_passcode: "", public_summary: "" });
export const emptyEventDate = (): EventDateDraft => ({ key: crypto.randomUUID(), session_id: null, date: "", start: "", end: "", label: "", location: null });

/** Structural validation permits incomplete drafts without accepting executable URLs. */
export function parseDateLocationDraft(input: unknown): EventDateLocationDraft {
  if (!input || typeof input !== "object") throw new Error("Invalid date and location settings.");
  const value = input as EventDateLocationDraft;
  const locationValid = (location: LocationDraft) => location && ["in_person", "online", "hybrid"].includes(location.type) &&
    [location.building, location.room, location.address, location.map_url, location.meeting_url, location.meeting_id, location.meeting_passcode, location.public_summary].every(item => typeof item === "string") &&
    [location.map_url, location.meeting_url].every(url => !/^[a-z][a-z0-9+.-]*:/i.test(url.trim()) || /^https?:/i.test(url.trim()));
  if (value.automatic !== true || !["everyone", "going"].includes(value.audience) || !locationValid(value.location) || !Array.isArray(value.dates) || value.dates.length > 100 || value.dates.some(row => !row || [row.key, row.date, row.start, row.end, row.label].some(item => typeof item !== "string") || !(row.session_id === null || typeof row.session_id === "string") || (row.location !== null && !locationValid(row.location)))) throw new Error("Invalid date and location settings.");
  if (new Set(value.dates.map(row => row.key)).size !== value.dates.length) throw new Error("Each date must have its own identity.");
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
    const problem = target.startsWith("date-") && required
      ? "Every date needs a valid date, start and end in Pacific time. Clock-transition times must be unambiguous."
      : message === "Building is required." || message === "Street address is required."
        ? "In-person locations require a building and street address."
        : message;
    issues.push({ target, message, required, problem });
  };
  if (config.automatic) {
    if (!config.dates.length) add("builder-dates", "Add at least one event date.", true);
    for (const row of config.dates) {
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
  for (const [key, location] of [["default", config.location], ...config.dates.filter(row => row.location).map(row => [row.key, row.location!] as const)] as const) {
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
  return value.dates.map(row => ({ id: row.session_id, name: row.label || row.date, start_time: strictPacificTimestamp(`${row.date}T${row.start}`)!, end_time: strictPacificTimestamp(`${row.date}T${row.end}`)! }));
}
