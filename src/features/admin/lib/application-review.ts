import type { DateTimeValue } from "@/components/ui/date-time-field";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import { STUDENT_STATUSES } from "@/lib/constants";
import { pacificDate, timestamptzToDatetimeLocal } from "@/lib/date";
import type { IsoDate, WallTime } from "@/lib/date-input";
import type {
  EventApplicationRow,
  EventApplicationSettingsRow,
  StudentStatus,
  SubmittedApplicationStatus,
  UniversityYear,
} from "@/lib/supabase/models";

/**
 * What admins see for an application (docs/event-states.md, "Admin:
 * application"). `accepted` splits three ways by its deadline and ticket.
 * Drafts have no review state: admins never see them.
 */
export type ApplicationReviewState =
  | "submitted"
  | "waitlisted"
  | "accepted"
  | "registered"
  | "offer_expired"
  | "rejected";

export const APPLICATION_REVIEW_STATE_LABELS: Record<
  ApplicationReviewState,
  string
> = {
  submitted: "Submitted",
  waitlisted: "Waitlisted",
  accepted: "Accepted",
  registered: "Going",
  offer_expired: "Offer expired",
  rejected: "Rejected",
};

export function getApplicationReviewState(
  application: Pick<EventApplicationRow, "offer_expires_at"> & {
    status: SubmittedApplicationStatus;
  },
  hasTicket: boolean,
  now: Date = new Date()
): ApplicationReviewState {
  if (application.status !== "accepted") return application.status;
  if (hasTicket) return "registered";

  const expiresAt = application.offer_expires_at
    ? Date.parse(application.offer_expires_at)
    : Number.NaN;
  return expiresAt > now.getTime() ? "accepted" : "offer_expired";
}

/** A decision an admin can make from a given state. */
export type ApplicationDecision = "accept" | "waitlist" | "reject";

/**
 * The decisions the database allows from each state. Accepting an accepted or
 * expired offer sets a new deadline; rejecting one takes it back, which the
 * database refuses once the person has a ticket.
 *
 * Before decisions are released (`released` false) nobody has seen them, so
 * any decision can change to any other until the applicant registers.
 */
export function getApplicationDecisions(
  state: ApplicationReviewState,
  released = true
): ApplicationDecision[] {
  if (!released) {
    switch (state) {
      case "submitted":
      case "accepted":
      case "offer_expired":
        return ["accept", "waitlist", "reject"];
      case "waitlisted":
        return ["accept", "reject"];
      case "rejected":
        return ["accept", "waitlist"];
      case "registered":
        return [];
    }
  }
  switch (state) {
    case "submitted":
      return ["accept", "waitlist", "reject"];
    case "waitlisted":
    case "accepted":
    case "offer_expired":
      return ["accept", "reject"];
    case "registered":
    case "rejected":
      return [];
  }
}

/** Whether decisions are visible to applicants at `now`: no release, or it has passed. */
export function decisionsReleased(
  decisionsReleaseAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  return !decisionsReleaseAt || Date.parse(decisionsReleaseAt) <= now.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The offer deadline the decision card starts from (docs/event-states.md,
 * "Decision release"). An offer can't end before decisions are released, so
 * the earliest moment is the later of now and the release. The event's
 * "Confirm by" is used when it's after that moment; otherwise a week after
 * it, at 11:45 PM Pacific. Changing "Confirm by" never moves offers already
 * made.
 */
export function defaultOfferDeadline(
  settings: Pick<
    EventApplicationSettingsRow,
    "decisions_release_at" | "confirmation_deadline"
  > | null,
  now: Date = new Date()
): DateTimeValue {
  const release = settings?.decisions_release_at
    ? Date.parse(settings.decisions_release_at)
    : Number.NaN;
  const earliest = Math.max(now.getTime(), Number.isFinite(release) ? release : 0);
  const confirmBy = settings?.confirmation_deadline ?? null;

  if (confirmBy && Date.parse(confirmBy) > earliest) {
    const [date, time] = timestamptzToDatetimeLocal(confirmBy).split("T");
    if (date && time) return { date: date as IsoDate, time: time as WallTime };
  }

  return {
    date: pacificDate(new Date(earliest + 7 * DAY_MS).toISOString()) as IsoDate,
    time: "23:45" as WallTime,
  };
}

const DECISION_STATUS: Record<ApplicationDecision, SubmittedApplicationStatus> = {
  accept: "accepted",
  waitlist: "waitlisted",
  reject: "rejected",
};

/**
 * Turns a decision into the row update, or explains why it is invalid. An
 * acceptance needs a future `offerExpiresAt` with a timezone; any other
 * decision clears the deadline.
 */
export function buildApplicationDecisionUpdate(
  decision: ApplicationDecision,
  offerExpiresAt: string | null,
  now: Date = new Date()
):
  | {
      ok: true;
      update: Pick<EventApplicationRow, "offer_expires_at"> & {
        status: SubmittedApplicationStatus;
      };
    }
  | { ok: false; error: string } {
  if (!Object.hasOwn(DECISION_STATUS, decision)) {
    return { ok: false, error: "Invalid application decision." };
  }

  if (decision !== "accept") {
    return {
      ok: true,
      update: { status: DECISION_STATUS[decision], offer_expires_at: null },
    };
  }

  if (
    !offerExpiresAt ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(offerExpiresAt) ||
    !Number.isFinite(Date.parse(offerExpiresAt))
  ) {
    return { ok: false, error: "Accepting an application needs an offer deadline." };
  }

  if (Date.parse(offerExpiresAt) <= now.getTime()) {
    return { ok: false, error: "The offer deadline must be in the future." };
  }

  return {
    ok: true,
    update: { status: "accepted", offer_expires_at: offerExpiresAt },
  };
}

// --- How an applicant's profile reads ----------------------------------------

export const YEAR_LABELS: Record<UniversityYear, string> = {
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  "5+": "5th year or later",
};

export const STUDENT_STATUS_LABELS = Object.fromEntries(
  STUDENT_STATUSES.map((status) => [status.value, status.label])
) as Record<StudentStatus, string>;

/** A tier's display name, or "Non-member" when there is no active one. */
export function membershipLabel(membership: string | null): string {
  return membership ? formatMembershipTypeName(membership) : "Non-member";
}

// --- The review list's view: filters, sort, paging, neighbours ---------------

/** Applicants per page on the review list. */
export const REVIEW_PAGE_SIZE = 25;

/** The filter chips' order: the review queue first, then by how far along. */
export const REVIEW_STATE_QUEUE: readonly ApplicationReviewState[] = [
  "submitted",
  "waitlisted",
  "accepted",
  "registered",
  "offer_expired",
  "rejected",
];

/** Entering the list with no `status` selects the queue's head. */
export const DEFAULT_REVIEW_STATUSES: readonly ApplicationReviewState[] = [
  "submitted",
];

/** `name` is A to Z; older links with `sort=name` keep working. */
export type ReviewSort = "oldest" | "newest" | "name" | "name-desc";
export const DEFAULT_REVIEW_SORT: ReviewSort = "oldest";
export const REVIEW_SORTS: readonly { value: ReviewSort; label: string }[] = [
  { value: "oldest", label: "Applied: oldest first" },
  { value: "newest", label: "Applied: newest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];

/**
 * One applicant as the list and the pager see them: the summary with its
 * derived review state. `noteCount` is absent until reviewer notes are wired
 * in; the Notes column only shows when it is present.
 */
export interface ReviewListItem {
  applicationId: string;
  name: string;
  email: string;
  program: string | null;
  year: UniversityYear | null;
  studentStatus: StudentStatus | null;
  /** The active membership tier's stored name; null for a non-member. */
  membership: string | null;
  appliedAt: string;
  state: ApplicationReviewState;
  offerExpiresAt: string | null;
  noteCount?: number;
}

/** The membership filter's value for an applicant without an active tier. */
export const NO_MEMBERSHIP = "none";

/**
 * The Sort and filter panel's filters. Values within one are alternatives
 * (any matches); the filters, the status chips and the search intersect. An
 * empty list doesn't filter.
 */
export interface ReviewFilters {
  /** Tier names, or `NO_MEMBERSHIP`. */
  memberships: string[];
  years: UniversityYear[];
  studentStatuses: StudentStatus[];
  /** Program keys (`programKey`), or `OTHER_PROGRAM`. */
  programs: string[];
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  memberships: [],
  years: [],
  studentStatuses: [],
  programs: [],
};

/**
 * The list's view state. It lives in the URL (`?status=waitlisted,accepted&
 * sort=name&q=ana&page=2&year=3,4&program=design`) so back, refresh and
 * sharing keep it. `from` is the applicant you came back from; it highlights
 * their row.
 */
export interface ReviewListQuery extends ReviewFilters {
  /** Empty means every state (`status=all`). */
  statuses: ApplicationReviewState[];
  sort: ReviewSort;
  q: string;
  page: number;
  from?: string;
}

/** What filters the list: everything but the sort, page and highlight. */
export type ReviewListView = Pick<ReviewListQuery, "statuses" | "sort" | "q"> &
  Partial<ReviewFilters>;

type ParamSource = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

const YEARS = Object.keys(YEAR_LABELS) as UniversityYear[];
const STUDENT_STATUS_VALUES = STUDENT_STATUSES.map((status) => status.value);

/** A comma list, kept to the values `allowed` names (in its order). */
function listParam<T extends string>(
  params: ParamSource,
  name: string,
  allowed?: readonly T[]
): T[] {
  const raw = params.get(name);
  if (!raw) return [];
  const values = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
  return allowed
    ? allowed.filter((value) => values.includes(value))
    : (values.slice(0, 20) as T[]);
}

export function parseReviewListQuery(params: ParamSource): ReviewListQuery {
  const rawStatus = params.get("status");
  const statuses =
    rawStatus === null
      ? [...DEFAULT_REVIEW_STATUSES]
      : REVIEW_STATE_QUEUE.filter((state) =>
          rawStatus.split(",").includes(state)
        );

  const rawSort = params.get("sort");
  const sort =
    REVIEW_SORTS.find((option) => option.value === rawSort)?.value ??
    DEFAULT_REVIEW_SORT;

  const page = Number.parseInt(params.get("page") ?? "", 10);
  const from = params.get("from");

  return {
    statuses,
    sort,
    q: (params.get("q") ?? "").slice(0, 100),
    page: Number.isFinite(page) && page > 1 ? page : 1,
    memberships: listParam(params, "membership"),
    years: listParam(params, "year", YEARS),
    studentStatuses: listParam(params, "student", STUDENT_STATUS_VALUES),
    // Program names are free text and may hold commas: one param each.
    programs: [...new Set(params.getAll("program").map((value) => value.trim()).filter(Boolean))].slice(0, 20),
    ...(from ? { from } : {}),
  };
}

/** The query string (with its `?`, or empty) for a view; defaults are left out. */
export function serializeReviewListQuery(query: ReviewListQuery): string {
  const params = new URLSearchParams();
  const isDefaultStatus =
    query.statuses.length === DEFAULT_REVIEW_STATUSES.length &&
    query.statuses.every((state, i) => state === DEFAULT_REVIEW_STATUSES[i]);
  if (query.statuses.length === 0) params.set("status", "all");
  else if (!isDefaultStatus) params.set("status", query.statuses.join(","));
  if (query.sort !== DEFAULT_REVIEW_SORT) params.set("sort", query.sort);
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.memberships.length) params.set("membership", query.memberships.join(","));
  if (query.years.length) params.set("year", query.years.join(","));
  if (query.studentStatuses.length) {
    params.set("student", query.studentStatuses.join(","));
  }
  for (const program of query.programs) params.append("program", program);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.from) params.set("from", query.from);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** How many filter values the panel has on, for "Sort and filter · 3". */
export function countReviewFilters(filters: Partial<ReviewFilters>): number {
  return (
    (filters.memberships?.length ?? 0) +
    (filters.years?.length ?? 0) +
    (filters.studentStatuses?.length ?? 0) +
    (filters.programs?.length ?? 0)
  );
}

// --- Program options, from the applicants themselves -------------------------

/** The program filter's value for the programs not listed, and no program. */
export const OTHER_PROGRAM = "other";

/** Programs listed by name before the rest fold into Other. */
export const PROGRAM_OPTION_LIMIT = 6;

/** Programs are free text: "Design" and " design " are one. */
export function programKey(program: string | null): string | null {
  const key = program?.trim().replace(/\s+/g, " ").toLowerCase();
  return key || null;
}

/**
 * The program filter's options: the most common programs among the
 * applicants (ties by name), then Other for the rest and for applicants
 * without one. Both pages derive them from the same full list, so the table
 * and the pager agree on what Other holds.
 */
export function programOptions(
  items: readonly Pick<ReviewListItem, "program">[],
  limit: number = PROGRAM_OPTION_LIMIT
): { value: string; label: string }[] {
  const byKey = new Map<string, { label: string; count: number }>();
  let unlisted = 0;
  for (const { program } of items) {
    const key = programKey(program);
    // Someone who typed "Other" belongs with the others.
    if (!program || !key || key === OTHER_PROGRAM) {
      unlisted += 1;
      continue;
    }
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { label: program.trim().replace(/\s+/g, " "), count: 1 });
  }
  const ranked = [...byKey.entries()].sort(
    ([, a], [, b]) => b.count - a.count || a.label.localeCompare(b.label, "en")
  );
  const listed = ranked.slice(0, limit);
  unlisted += ranked.slice(limit).reduce((sum, [, entry]) => sum + entry.count, 0);
  return [
    ...listed.map(([value, entry]) => ({ value, label: entry.label })),
    ...(unlisted > 0 ? [{ value: OTHER_PROGRAM, label: "Other" }] : []),
  ];
}

/** Adds the derived review state to an application summary. */
export function withReviewState<
  T extends {
    status: SubmittedApplicationStatus;
    offerExpiresAt: string | null;
    hasTicket: boolean;
  },
>(summary: T, now: Date = new Date()): T & { state: ApplicationReviewState } {
  return {
    ...summary,
    state: getApplicationReviewState(
      { status: summary.status, offer_expires_at: summary.offerExpiresAt },
      summary.hasTicket,
      now
    ),
  };
}

function compareItems(sort: ReviewSort) {
  return (a: ReviewListItem, b: ReviewListItem) => {
    const byDate = a.appliedAt.localeCompare(b.appliedAt);
    const result =
      sort === "newest"
        ? -byDate
        : sort === "name"
          ? a.name.localeCompare(b.name, "en") || byDate
          : sort === "name-desc"
            ? b.name.localeCompare(a.name, "en") || byDate
            : byDate;
    return result || a.applicationId.localeCompare(b.applicationId);
  };
}

/**
 * The items a view shows: filtered by status, search and the panel's
 * filters, then sorted. Program filters are matched against the options
 * `programOptions` derives from `items`, so pass the event's whole list.
 */
export function filterReviewItems<T extends ReviewListItem>(
  items: readonly T[],
  query: ReviewListView
): T[] {
  const needle = query.q.trim().toLowerCase();
  const memberships = query.memberships ?? [];
  const years = query.years ?? [];
  const studentStatuses = query.studentStatuses ?? [];
  const programs = query.programs ?? [];
  const listedPrograms = new Set(
    programs.length ? programOptions(items).map((option) => option.value) : []
  );
  const programValue = (item: ReviewListItem) => {
    const key = programKey(item.program);
    return key && listedPrograms.has(key) && key !== OTHER_PROGRAM
      ? key
      : OTHER_PROGRAM;
  };
  return items
    .filter(
      (item) =>
        (query.statuses.length === 0 || query.statuses.includes(item.state)) &&
        (!needle || `${item.name} ${item.email}`.toLowerCase().includes(needle)) &&
        (memberships.length === 0 ||
          memberships.includes(item.membership ?? NO_MEMBERSHIP)) &&
        (years.length === 0 || (item.year !== null && years.includes(item.year))) &&
        (studentStatuses.length === 0 ||
          (item.studentStatus !== null &&
            studentStatuses.includes(item.studentStatus))) &&
        (programs.length === 0 || programs.includes(programValue(item)))
    )
    .sort(compareItems(query.sort));
}

export function countReviewStates(
  items: readonly Pick<ReviewListItem, "state">[]
): Record<ApplicationReviewState, number> {
  const counts = Object.fromEntries(
    REVIEW_STATE_QUEUE.map((state) => [state, 0])
  ) as Record<ApplicationReviewState, number>;
  for (const item of items) counts[item.state] += 1;
  return counts;
}

/** What the pager's "3 of 18 · …" counts. */
export function reviewScopeLabel(
  query: Pick<ReviewListQuery, "statuses" | "q"> & Partial<ReviewFilters>
): string {
  if (query.q.trim() || countReviewFilters(query) > 0) return "Filtered list";
  if (query.statuses.length === 0) return "All applicants";
  if (query.statuses.length === 1) {
    return APPLICATION_REVIEW_STATE_LABELS[query.statuses[0]];
  }
  return "Filtered list";
}

/**
 * Where an applicant sits in the list a reviewer came from. The applicant is
 * held in place even after a decision moves them out of the filter, so Next
 * never skips anyone. `page` is the list page they are on, or `null` when
 * they are no longer in the filtered list. `null` overall: not on the event.
 */
export function getReviewNeighbours<T extends ReviewListItem>(
  items: readonly T[],
  query: ReviewListView,
  currentId: string,
  pageSize: number = REVIEW_PAGE_SIZE
): {
  position: number;
  total: number;
  previous: T | null;
  next: T | null;
  page: number | null;
} | null {
  const results = filterReviewItems(items, query);
  const inList = results.some((item) => item.applicationId === currentId);
  let order = results;
  if (!inList) {
    const current = items.find((item) => item.applicationId === currentId);
    if (!current) return null;
    order = [...results, current].sort(compareItems(query.sort));
  }
  const index = order.findIndex((item) => item.applicationId === currentId);
  return {
    position: index + 1,
    total: order.length,
    previous: order[index - 1] ?? null,
    next: order[index + 1] ?? null,
    page: inList ? Math.floor(index / pageSize) + 1 : null,
  };
}
