"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, ClipboardList, MessageSquareText } from "lucide-react";

import { BackButton } from "@/components/shared/BackButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  SortFilterPanel,
  SortFilterSection,
} from "@/components/shared/SortFilterPanel";
import { TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DateTimeField,
  type DateTimeValue,
} from "@/components/ui/date-time-field";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowButton,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { ApplicantPager } from "@/features/admin/components/ApplicantPager";
import { ChipFilterSection } from "@/features/admin/components/ChipFilterSection";
import {
  REVIEW_STATE_BADGES,
  REVIEW_STATE_ORDER,
  ReviewStateBadge,
} from "@/features/admin/components/ReviewStateBadge";
import {
  getApplicationDecisions,
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import { ApplicationAnswersReadOnly } from "@/features/applications/components/ApplicationAnswersReadOnly";
import {
  ReviewerNotes,
  type ReviewerNote,
} from "@/features/applications/components/ReviewerNotes";
import {
  datetimeLocalToTimestamptz,
  formatEventDate,
  formatTimestamp,
  timestamptzToDatetimeLocal,
} from "@/lib/date";

import {
  APPLICANTS,
  CAPACITY,
  EVENT_NAME,
  FEATURED_APPLICANT,
  QUESTIONS,
  REVIEWER,
  REVIEW_NOW,
  answersFor,
  notesFor,
  type Applicant,
} from "@/app/dev/gallery/_review-fixtures";

/**
 * The proposed Applications pages (docs/design/application-review.md): the
 * list, and one application with its decision and reviewer notes. One flow
 * in local state, so moving between them shows what the design keeps: the
 * list's search, filters, sort and page, and the row you came from.
 *
 * In the app each view is its own route and that state lives in the URL
 * (`?status=submitted&sort=oldest&q=&page=2`); here it lives in React.
 */

const TEMPLATES_HREF = "/dev/templates";
const PAGE_SIZE = 10;

type Sort = "oldest" | "newest" | "name" | "fewest-notes";
const SORTS: readonly { value: Sort; label: string }[] = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name, A to Z" },
  { value: "fewest-notes", label: "Fewest notes first" },
];
const DEFAULT_SORT: Sort = "oldest";

type NotesFilter = "with" | "without";
const NOTE_OPTIONS: readonly { value: NotesFilter; label: string }[] = [
  { value: "with", label: "Has notes" },
  { value: "without", label: "No notes yet" },
];

const NOUN = { one: "applicant", other: "applicants" };

function compare(sort: Sort) {
  return (a: Applicant, b: Applicant) => {
    switch (sort) {
      case "newest":
        return b.submittedAt.localeCompare(a.submittedAt);
      case "name":
        return a.name.localeCompare(b.name, "en");
      case "fewest-notes":
        return a.noteCount - b.noteCount || a.submittedAt.localeCompare(b.submittedAt);
      default:
        return a.submittedAt.localeCompare(b.submittedAt);
    }
  };
}

const shortDate = (iso: string) =>
  formatEventDate(iso, { month: "short", year: undefined }) ?? iso;

const firstName = (name: string) => name.split(" ")[0];

/** Following a link inside `children` runs `onFollow` instead (the gallery has no routes). */
function Intercept({ onFollow, children }: { onFollow: () => void; children: ReactNode }) {
  return (
    <div
      className="contents"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a")) {
          event.preventDefault();
          onFollow();
        }
      }}
    >
      {children}
    </div>
  );
}

interface ListState {
  query: string;
  statuses: ReadonlySet<ApplicationReviewState>;
  notes: ReadonlySet<NotesFilter>;
  sort: Sort;
  page: number;
}

// --- The flow ---------------------------------------------------------------

export function ApplicationReviewFlow({ start }: { start: "list" | "detail" }) {
  const [applicants, setApplicants] = useState<Applicant[]>(() => [...APPLICANTS]);
  const [threads, setThreads] = useState<Record<string, ReviewerNote[]>>(() =>
    Object.fromEntries(APPLICANTS.map((applicant) => [applicant.id, notesFor(applicant)])),
  );
  const [openId, setOpenId] = useState<string | null>(
    start === "detail" ? FEATURED_APPLICANT.id : null,
  );
  /** The row to highlight and focus on the way back. */
  const [lastViewed, setLastViewed] = useState<string | null>(null);
  const [list, setList] = useState<ListState>({
    query: "",
    statuses: new Set<ApplicationReviewState>(["submitted"]),
    notes: new Set<NotesFilter>(),
    sort: DEFAULT_SORT,
    page: 1,
  });

  const needle = list.query.trim().toLowerCase();
  const matches = (applicant: Applicant) =>
    (!needle || `${applicant.name} ${applicant.email}`.toLowerCase().includes(needle)) &&
    (list.statuses.size === 0 || list.statuses.has(applicant.state)) &&
    (list.notes.size === 0 ||
      (list.notes.has("with") && applicant.noteCount > 0) ||
      (list.notes.has("without") && applicant.noteCount === 0));
  const results = applicants.filter(matches).sort(compare(list.sort));

  const open = applicants.find((applicant) => applicant.id === openId);

  if (open) {
    // Neighbours by the list's sort, with the open applicant kept in place even
    // once a decision moves it out of the filter, so "Next" never skips.
    const order = results.some((applicant) => applicant.id === open.id)
      ? results
      : [...results, open].sort(compare(list.sort));
    const index = order.findIndex((applicant) => applicant.id === open.id);
    const neighbour = (at: number) =>
      order[at] ? { href: TEMPLATES_HREF, name: order[at].name, id: order[at].id } : null;
    const scope =
      list.statuses.size === 1
        ? REVIEW_STATE_BADGES[[...list.statuses][0]].label
        : list.statuses.size === 0 && !needle
          ? "All applicants"
          : "Filtered list";

    return (
      <ApplicationPage
        applicant={open}
        notes={threads[open.id] ?? []}
        onNotesChange={(notes) =>
          setThreads((current) => ({ ...current, [open.id]: notes }))
        }
        position={index + 1}
        total={order.length}
        scope={scope}
        previous={neighbour(index - 1)}
        next={neighbour(index + 1)}
        onOpen={(id) => setOpenId(id)}
        onBack={() => {
          setLastViewed(open.id);
          const at = results.findIndex((applicant) => applicant.id === open.id);
          if (at >= 0) setList((current) => ({ ...current, page: Math.floor(at / PAGE_SIZE) + 1 }));
          setOpenId(null);
        }}
        onDecided={(state, offerExpiresAt) =>
          setApplicants((current) =>
            current.map((applicant) =>
              applicant.id === open.id ? { ...applicant, state, offerExpiresAt } : applicant,
            ),
          )
        }
      />
    );
  }

  return (
    <ApplicationsList
      applicants={applicants}
      results={results}
      list={list}
      onListChange={(next) => setList((current) => ({ ...current, page: 1, ...next }))}
      lastViewed={lastViewed}
      onOpen={(id) => {
        setLastViewed(id);
        setOpenId(id);
      }}
    />
  );
}

// --- The list -----------------------------------------------------------------

function ApplicationsList({
  applicants,
  results,
  list,
  onListChange,
  lastViewed,
  onOpen,
}: {
  applicants: readonly Applicant[];
  results: readonly Applicant[];
  list: ListState;
  onListChange: (next: Partial<ListState>) => void;
  lastViewed: string | null;
  onOpen: (id: string) => void;
}) {
  const lastRowRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(list.page, pages);
  const rows = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const countOf = (state: ApplicationReviewState) =>
    applicants.filter((applicant) => applicant.state === state).length;
  const going = countOf("registered");
  const filterCount = list.notes.size + (list.sort === DEFAULT_SORT ? 0 : 1);

  // Back from an application: focus its row, as a drawer's close does (§3.15).
  useEffect(() => {
    lastRowRef.current?.focus({ preventScroll: false });
  }, []);

  const toggle = <T,>(set: ReadonlySet<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <PageContainer className="flex flex-col gap-8">
      <Intercept onFollow={() => toast("In the app, this goes back to Manage Events.")}>
        <BackButton link={TEMPLATES_HREF} label="Back to Manage Events" className="-mb-2 w-fit" />
      </Intercept>
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          {EVENT_NAME} · Applications closed Nov 3 · Event Jan 9–10
        </p>
      </header>

      <section aria-label="Review progress" className="grid gap-3 sm:grid-cols-3">
        <StatCard kind="value" label="To review" value={countOf("submitted")} />
        <StatCard kind="value" label="Offers out" value={countOf("accepted")} />
        <StatCard kind="rate" label="Seats filled" count={going} total={CAPACITY} noun="seats" />
      </section>

      <div className="flex flex-col gap-4">
        <TableToolbar
          search={
            <SearchField
              ref={searchRef}
              label="Search applicants"
              placeholder="Search by name or email"
              value={list.query}
              onValueChange={(query) => onListChange({ query })}
            />
          }
          actions={
            <SortFilterPanel
              activeCount={filterCount}
              summary={`${results.length} ${results.length === 1 ? NOUN.one : NOUN.other}`}
              onClearAll={() => onListChange({ notes: new Set(), sort: DEFAULT_SORT })}
            >
              <SortFilterSection title="Sort by">
                <Select value={list.sort} onValueChange={(sort) => onListChange({ sort: sort as Sort })}>
                  <SelectTrigger aria-label="Sort by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SortFilterSection>
              <ChipFilterSection
                title="Reviewer notes"
                options={NOTE_OPTIONS}
                selected={list.notes}
                onToggle={(value) => onListChange({ notes: toggle(list.notes, value) })}
              />
            </SortFilterPanel>
          }
        />
        <FilterChipGroup aria-label="Filter by status">
          {REVIEW_STATE_ORDER.map((state) => (
            <FilterChip
              key={state}
              count={countOf(state)}
              pressed={list.statuses.has(state)}
              onPressedChange={() => onListChange({ statuses: toggle(list.statuses, state) })}
            >
              {REVIEW_STATE_BADGES[state].label}
            </FilterChip>
          ))}
        </FilterChipGroup>

        <TableCard>
          <Table stickyFirstColumn className="min-w-[44rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead className="w-32">Submitted</TableHead>
                <TableHead className="w-24">Notes</TableHead>
                <TableHead className="w-40">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={4}>No applicants match your search and filters.</TableEmpty>
              ) : (
                rows.map((applicant) => {
                  const current = applicant.id === lastViewed;
                  return (
                    <TableRow key={applicant.id}>
                      <TableCell className="max-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={applicant.name} src={applicant.avatarUrl} size={32} decorative />
                          <div className="flex min-w-0 flex-col">
                            <TableRowButton
                              ref={current ? lastRowRef : undefined}
                              aria-current={current ? "true" : undefined}
                              className="truncate font-medium"
                              onClick={() => onOpen(applicant.id)}
                            >
                              {applicant.name}
                            </TableRowButton>
                            <span className="truncate text-small text-muted-foreground">
                              {applicant.program}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {shortDate(applicant.submittedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {applicant.noteCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <MessageSquareText aria-hidden className="size-4" />
                            {applicant.noteCount}
                            <span className="sr-only">
                              {applicant.noteCount === 1 ? " note" : " notes"}
                            </span>
                          </span>
                        ) : (
                          <TableNone />
                        )}
                      </TableCell>
                      <TableCell>
                        <ReviewStateBadge state={applicant.state} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={results.length}
            onPageChange={(next) => onListChange({ page: next })}
            summary={
              <TableRowCount
                count={{
                  shown: results.length,
                  total: applicants.length,
                  noun: NOUN,
                  range: {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, results.length),
                  },
                }}
                onClearFilters={() => {
                  onListChange({ query: "", statuses: new Set(), notes: new Set() });
                  searchRef.current?.focus();
                }}
              />
            }
          />
        </TableCard>
      </div>
    </PageContainer>
  );
}

/** The list before anyone has applied (§3.6: EmptyState when the whole page is empty). */
export function ApplicationsEmpty() {
  return (
    <TableCard>
      <EmptyState
        size="page"
        icon={<ClipboardList aria-hidden />}
        title="No applications yet"
        description="Applications show up here once people submit them. Drafts stay private to the applicant until then."
      />
    </TableCard>
  );
}

// --- One application ------------------------------------------------------------

function ApplicationPage({
  applicant,
  notes,
  onNotesChange,
  position,
  total,
  scope,
  previous,
  next,
  onOpen,
  onBack,
  onDecided,
}: {
  applicant: Applicant;
  notes: readonly ReviewerNote[];
  onNotesChange: (notes: ReviewerNote[]) => void;
  position: number;
  total: number;
  scope: string;
  previous: { href: string; name: string; id: string } | null;
  next: { href: string; name: string; id: string } | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  onDecided: (state: ApplicationReviewState, offerExpiresAt: string | null) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answers = answersFor(applicant);
  const wait = () => new Promise((resolve) => setTimeout(resolve, 450));

  // A new applicant is a new page: start at the top, focus on the name.
  useEffect(() => {
    headingRef.current?.focus();
  }, [applicant.id]);

  return (
    <PageContainer key={applicant.id} className="@container flex flex-col gap-8">
      <Intercept onFollow={onBack}>
        <BackButton link={TEMPLATES_HREF} label="Back to applications" className="-mb-2 w-fit" />
      </Intercept>

      <header className="flex flex-col gap-5 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={applicant.name} src={applicant.avatarUrl} size={56} decorative />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 ref={headingRef} tabIndex={-1} className="text-h2 outline-none">
                {applicant.name}
              </h1>
              <ReviewStateBadge state={applicant.state} />
            </div>
            <p className="text-small text-muted-foreground">
              {applicant.program} ·{" "}
              <a
                href={`mailto:${applicant.email}`}
                className="text-info-foreground underline-offset-4 hover:underline focus-visible:focus-ring"
              >
                {applicant.email}
              </a>
            </p>
            <p className="text-small text-muted-foreground">
              Submitted {formatTimestamp(applicant.submittedAt)}
            </p>
          </div>
        </div>
        <ApplicantPager
          position={position}
          total={total}
          scope={scope}
          previous={previous}
          next={next}
          onNavigate={(event, direction) => {
            event.preventDefault();
            const target = direction === "next" ? next : previous;
            if (target) onOpen(target.id);
          }}
          className="shrink-0"
        />
      </header>

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <Card role="region" aria-labelledby={`answers-${applicant.id}`}>
          <CardHeader>
            <CardTitle id={`answers-${applicant.id}`} role="heading" aria-level={2}>
              Answers
            </CardTitle>
            <CardDescription>
              {EVENT_NAME} application · {QUESTIONS.length} questions
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ApplicationAnswersReadOnly
              questions={QUESTIONS}
              answers={answers}
              fileLinks={answers["q-resume"] ? { "q-resume": "#resume" } : {}}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <DecisionCard
            key={`${applicant.id}-${applicant.state}`}
            applicant={applicant}
            next={next}
            onOpenNext={() => next && onOpen(next.id)}
            onDecided={onDecided}
          />
          <ReviewerNotes
            key={applicant.id}
            notes={notes}
            currentUserId={REVIEWER.id}
            now={REVIEW_NOW}
            onAdd={async (body) => {
              await wait();
              onNotesChange([
                ...notes,
                {
                  id: `${applicant.id}-${notes.length}-${body.length}`,
                  body,
                  createdAt: REVIEW_NOW.toISOString(),
                  author: REVIEWER,
                },
              ]);
            }}
            onEdit={async (id, body) => {
              await wait();
              onNotesChange(
                notes.map((note) =>
                  note.id === id ? { ...note, body, editedAt: REVIEW_NOW.toISOString() } : note,
                ),
              );
            }}
            onDelete={async (id) => {
              await wait();
              onNotesChange(notes.filter((note) => note.id !== id));
            }}
          />
        </div>
      </div>
    </PageContainer>
  );
}

// --- The decision ---------------------------------------------------------------

/**
 * The deadline field starts on the offer's current deadline, else a default a
 * week out. In the app the default is the deadline this admin last used for
 * the event, so 50 acceptances don't mean typing it 50 times.
 */
const DEFAULT_DEADLINE: DateTimeValue = { date: "2026-11-11", time: "23:45" };

function initialDeadline(applicant: Applicant): DateTimeValue {
  const local = applicant.state === "accepted" ? timestamptzToDatetimeLocal(applicant.offerExpiresAt) : "";
  if (!local) return DEFAULT_DEADLINE;
  const [date, time] = local.split("T");
  return { date: date as DateTimeValue["date"], time: time as DateTimeValue["time"] };
}

function describe(state: ApplicationReviewState, applicant: Applicant): string {
  const name = firstName(applicant.name);
  const deadline = formatTimestamp(applicant.offerExpiresAt);
  switch (state) {
    case "submitted":
      return `Accept ${name} with a deadline to register, waitlist, or reject.`;
    case "waitlisted":
      return `${name} is on the waitlist. Accept when a spot opens, or reject.`;
    case "accepted":
      return `${name} has until ${deadline} to register. Move the deadline, or take the offer back.`;
    case "offer_expired":
      return `${name}’s offer ran out on ${deadline} without a registration. Offer again with a new deadline, or reject.`;
    case "registered":
      return `${name} registered, so the decision is final.`;
    case "rejected":
      return `${name} was rejected. The decision is final.`;
  }
}

function decisionLabel(decision: ApplicationDecision, state: ApplicationReviewState) {
  if (decision === "accept") {
    if (state === "accepted") return "Move deadline";
    if (state === "offer_expired") return "Offer again";
    return "Accept";
  }
  if (decision === "reject") return state === "accepted" ? "Take back offer" : "Reject";
  return "Waitlist";
}

const RESULT: Record<ApplicationDecision, ApplicationReviewState> = {
  accept: "accepted",
  waitlist: "waitlisted",
  reject: "rejected",
};

function DecisionCard({
  applicant,
  next,
  onOpenNext,
  onDecided,
}: {
  applicant: Applicant;
  next: { name: string } | null;
  onOpenNext: () => void;
  onDecided: (state: ApplicationReviewState, offerExpiresAt: string | null) => void;
}) {
  const id = useId();
  const { state } = applicant;
  const decisions = getApplicationDecisions(state);
  const [deadline, setDeadline] = useState<DateTimeValue>(() => initialDeadline(applicant));
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [pending, setPending] = useState<ApplicationDecision | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const offerExpiresAt =
    deadline.date && deadline.time
      ? datetimeLocalToTimestamptz(`${deadline.date}T${deadline.time}`)
      : null;
  const name = firstName(applicant.name);

  const decide = async (decision: ApplicationDecision) => {
    setPending(decision);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setPending(null);
    setConfirmingReject(false);
    const expires = decision === "accept" ? offerExpiresAt : null;
    onDecided(RESULT[decision], expires);
    toast.success(
      decision === "accept"
        ? `${name} accepted`
        : decision === "waitlist"
          ? `${name} waitlisted`
          : `${name} rejected`,
      {
        description:
          decision === "accept" ? `Register by ${formatTimestamp(expires)}` : undefined,
        action: next ? { label: "Next applicant", onClick: onOpenNext } : undefined,
      },
    );
  };

  return (
    <Card role="region" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle id={`${id}-title`} role="heading" aria-level={2}>
          Decision
        </CardTitle>
        <CardDescription>{describe(state, applicant)}</CardDescription>
      </CardHeader>
      {decisions.length > 0 ? (
        <CardContent className="flex flex-col gap-5">
          {decisions.includes("accept") ? (
            <Field data-invalid={deadlineError ? true : undefined}>
              <FieldLabel htmlFor={`${id}-deadline`}>Register by</FieldLabel>
              <DateTimeField
                id={`${id}-deadline`}
                value={deadline}
                onValueChange={setDeadline}
                onValidityChange={setDeadlineError}
                dateLabel="Register by date"
                timeLabel="Register by time"
                min="2026-11-04"
                today="2026-11-04"
                disabled={pending !== null}
              />
              {deadlineError ? (
                <FieldError>{deadlineError}</FieldError>
              ) : (
                <FieldDescription>
                  Pacific Time. If {name} hasn’t registered by then, the spot opens up again.
                </FieldDescription>
              )}
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {decisions.map((decision) => (
              <Button
                key={decision}
                variant={decision === "accept" ? "primary" : "secondary"}
                size="sm"
                loading={pending === decision}
                disabled={
                  (pending !== null && pending !== decision) ||
                  (decision === "accept" && (!offerExpiresAt || Boolean(deadlineError)))
                }
                onClick={() =>
                  decision === "reject" ? setConfirmingReject(true) : void decide(decision)
                }
              >
                {decisionLabel(decision, state)}
              </Button>
            ))}
          </div>
        </CardContent>
      ) : null}
      <ConfirmDialog
        open={confirmingReject}
        onOpenChange={(open) => {
          if (pending === null) setConfirmingReject(open);
        }}
        icon={<CircleAlert aria-hidden />}
        title={state === "accepted" ? `Take back ${name}’s offer?` : `Reject ${name}’s application?`}
        description={`${name} will see “Not selected” on the event page. You can’t undo this.`}
        cancelLabel="Keep reviewing"
        confirmLabel={state === "accepted" ? "Take back offer" : "Reject"}
        pendingLabel={state === "accepted" ? "Taking back…" : "Rejecting…"}
        pending={pending === "reject"}
        onConfirm={() => void decide("reject")}
      />
    </Card>
  );
}
