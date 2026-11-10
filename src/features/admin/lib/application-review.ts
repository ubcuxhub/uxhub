import type {
  EventApplicationRow,
  SubmittedApplicationStatus,
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
 */
export function getApplicationDecisions(
  state: ApplicationReviewState
): ApplicationDecision[] {
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

export type ReviewSort = "oldest" | "newest" | "name";
export const DEFAULT_REVIEW_SORT: ReviewSort = "oldest";
export const REVIEW_SORTS: readonly { value: ReviewSort; label: string }[] = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name, A to Z" },
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
  appliedAt: string;
  state: ApplicationReviewState;
  offerExpiresAt: string | null;
  noteCount?: number;
}

/**
 * The list's view state. It lives in the URL (`?status=waitlisted,accepted&
 * sort=name&q=ana&page=2`) so back, refresh and sharing keep it. `from` is
 * the applicant you came back from; it highlights their row.
 */
export interface ReviewListQuery {
  /** Empty means every state (`status=all`). */
  statuses: ApplicationReviewState[];
  sort: ReviewSort;
  q: string;
  page: number;
  from?: string;
}

type ParamSource = { get(name: string): string | null };

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
  if (query.page > 1) params.set("page", String(query.page));
  if (query.from) params.set("from", query.from);
  const text = params.toString();
  return text ? `?${text}` : "";
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
          : byDate;
    return result || a.applicationId.localeCompare(b.applicationId);
  };
}

/** The items a view shows: filtered by status and search, then sorted. */
export function filterReviewItems<T extends ReviewListItem>(
  items: readonly T[],
  query: Pick<ReviewListQuery, "statuses" | "sort" | "q">
): T[] {
  const needle = query.q.trim().toLowerCase();
  return items
    .filter(
      (item) =>
        (query.statuses.length === 0 || query.statuses.includes(item.state)) &&
        (!needle || `${item.name} ${item.email}`.toLowerCase().includes(needle))
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
  query: Pick<ReviewListQuery, "statuses" | "q">
): string {
  if (query.q.trim()) return "Filtered list";
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
  query: Pick<ReviewListQuery, "statuses" | "sort" | "q">,
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
