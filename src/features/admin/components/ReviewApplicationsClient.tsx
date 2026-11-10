"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, MessageSquareText } from "lucide-react";

import { PageContainer } from "@/components/shared/PageContainer";
import {
  SortFilterPanel,
  SortFilterSection,
} from "@/components/shared/SortFilterPanel";
import { TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Pagination, clampPage } from "@/components/ui/pagination";
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
  TableRowLink,
} from "@/components/ui/table";
import {
  REVIEW_STATE_BADGES,
  ReviewStateBadge,
} from "@/features/admin/components/ReviewStateBadge";
import {
  DEFAULT_REVIEW_SORT,
  REVIEW_PAGE_SIZE,
  REVIEW_SORTS,
  REVIEW_STATE_QUEUE,
  countReviewStates,
  filterReviewItems,
  parseReviewListQuery,
  serializeReviewListQuery,
  type ApplicationReviewState,
  type ReviewListItem,
  type ReviewListQuery,
  type ReviewSort,
} from "@/features/admin/lib/application-review";
import { formatEventDate } from "@/lib/date";

interface ReviewApplicationsClientProps {
  eventId: string;
  eventName: string;
  /** "Applications closed Nov 3 · Event Jan 9–10", composed on the server. */
  subtitle?: string;
  /** Seats, for "Seats filled". 0 or absent hides that card. */
  capacity?: number;
  applications: ReviewListItem[];
}

const NOUN = { one: "applicant", other: "applicants" };

const shortDate = (iso: string) =>
  formatEventDate(iso, { month: "short", year: undefined }) ?? iso;

/**
 * The list's view state lives in the URL, so back, refresh and sharing keep it
 * (`?status=&sort=&q=&page=`). Changes use `history.replaceState`, which Next
 * folds into `useSearchParams` without a server round trip; the filtering is
 * done here, on the event's whole list, because the counts on the chips need
 * every row anyway. Changing anything resets the page and drops `from`, the
 * highlight for the row you came back from.
 */
function useReviewListQuery() {
  const searchParams = useSearchParams();
  const urlKey = searchParams?.toString() ?? "";
  const [state, setState] = useState(() => ({
    seen: urlKey,
    written: urlKey,
    query: parseReviewListQuery(new URLSearchParams(urlKey)),
  }));

  let query = state.query;
  // Back and forward change the URL under us; adopt it. Our own writes arrive
  // here too, once Next catches up, and are already in `query`.
  if (state.seen !== urlKey) {
    if (urlKey !== state.written) {
      query = parseReviewListQuery(new URLSearchParams(urlKey));
    }
    setState({ seen: urlKey, written: state.written, query });
  }

  const update = (patch: Partial<ReviewListQuery>) => {
    const next: ReviewListQuery = {
      ...query,
      page: 1,
      ...patch,
      from: undefined,
    };
    const search = serializeReviewListQuery(next);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}`
    );
    setState({ seen: state.seen, written: search.slice(1), query: next });
  };

  return [query, update] as const;
}

export function ReviewApplicationsClient({
  eventId,
  eventName,
  subtitle,
  capacity = 0,
  applications,
}: ReviewApplicationsClientProps) {
  const [query, update] = useReviewListQuery();
  const searchRef = useRef<HTMLInputElement>(null);
  const cameFromRef = useRef<HTMLAnchorElement>(null);

  const counts = countReviewStates(applications);
  const results = filterReviewItems(applications, query);
  const page = clampPage(query.page, REVIEW_PAGE_SIZE, results.length);
  const rows = results.slice(
    (page - 1) * REVIEW_PAGE_SIZE,
    page * REVIEW_PAGE_SIZE
  );
  const showNotes = applications.some((item) => item.noteCount !== undefined);
  const base = `/admin/events/${eventId}/review-applications`;

  // Back from an application: focus its row, as a drawer's close does.
  useEffect(() => {
    cameFromRef.current?.focus();
  }, []);

  const toggleStatus = (state: ApplicationReviewState) =>
    update({
      statuses: REVIEW_STATE_QUEUE.filter((candidate) =>
        candidate === state
          ? !query.statuses.includes(candidate)
          : query.statuses.includes(candidate)
      ),
    });

  const rowQuery = { ...query, from: undefined };
  const columns = showNotes ? 4 : 3;

  return (
    <PageContainer
      backHref="/admin/events"
      backLabel="Back to Manage Events"
      className="flex flex-col gap-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          {[eventName, subtitle].filter(Boolean).join(" · ")}
        </p>
      </header>

      {applications.length === 0 ? (
        <TableCard>
          <EmptyState
            size="page"
            icon={<ClipboardList aria-hidden />}
            title="No applications yet"
            description="Applications show up here once people submit them. Drafts stay private to the applicant until then."
          />
        </TableCard>
      ) : (
        <>
          <section
            aria-label="Review progress"
            className="grid gap-3 sm:grid-cols-3"
          >
            <StatCard kind="value" label="To review" value={counts.submitted} />
            <StatCard kind="value" label="Offers out" value={counts.accepted} />
            {capacity > 0 ? (
              <StatCard
                kind="rate"
                label="Seats filled"
                count={counts.registered}
                total={capacity}
                noun="seats"
              />
            ) : null}
          </section>

          <div className="flex flex-col gap-4">
            <TableToolbar
              search={
                <SearchField
                  ref={searchRef}
                  label="Search applicants"
                  placeholder="Search by name or email"
                  value={query.q}
                  onValueChange={(q) => update({ q })}
                />
              }
              actions={
                <SortFilterPanel
                  activeCount={query.sort === DEFAULT_REVIEW_SORT ? 0 : 1}
                  summary={`${results.length} ${results.length === 1 ? NOUN.one : NOUN.other}`}
                  onClearAll={() => update({ sort: DEFAULT_REVIEW_SORT })}
                >
                  <SortFilterSection title="Sort by">
                    <Select
                      value={query.sort}
                      onValueChange={(sort) => update({ sort: sort as ReviewSort })}
                    >
                      <SelectTrigger aria-label="Sort by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVIEW_SORTS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SortFilterSection>
                </SortFilterPanel>
              }
            />
            <FilterChipGroup aria-label="Filter by status">
              {REVIEW_STATE_QUEUE.map((state) => (
                <FilterChip
                  key={state}
                  count={counts[state]}
                  pressed={query.statuses.includes(state)}
                  onPressedChange={() => toggleStatus(state)}
                >
                  {REVIEW_STATE_BADGES[state].label}
                </FilterChip>
              ))}
            </FilterChipGroup>

            <TableCard>
              <Table stickyFirstColumn className="min-w-[40rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead className="w-32">Submitted</TableHead>
                    {showNotes ? (
                      <TableHead className="w-24">Notes</TableHead>
                    ) : null}
                    <TableHead className="w-40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableEmpty colSpan={columns}>
                      No applicants match your search and filters.
                    </TableEmpty>
                  ) : (
                    rows.map((item) => {
                      const current = item.applicationId === query.from;
                      return (
                        <TableRow key={item.applicationId}>
                          <TableCell className="max-w-0">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={item.name} size={32} decorative />
                              <div className="flex min-w-0 flex-col">
                                <TableRowLink
                                  ref={current ? cameFromRef : undefined}
                                  href={`${base}/${item.applicationId}${serializeReviewListQuery(rowQuery)}`}
                                  aria-current={current ? "true" : undefined}
                                  className="truncate font-medium"
                                >
                                  {item.name}
                                </TableRowLink>
                                {item.program ? (
                                  <span className="truncate text-small text-muted-foreground">
                                    {item.program}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {shortDate(item.appliedAt)}
                          </TableCell>
                          {showNotes ? (
                            <TableCell className="text-muted-foreground">
                              {item.noteCount ? (
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <MessageSquareText aria-hidden className="size-4" />
                                  {item.noteCount}
                                  <span className="sr-only">
                                    {item.noteCount === 1 ? " note" : " notes"}
                                  </span>
                                </span>
                              ) : (
                                <TableNone />
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <ReviewStateBadge state={item.state} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={REVIEW_PAGE_SIZE}
                total={results.length}
                onPageChange={(next) => {
                  if (next !== query.page) update({ page: next });
                }}
                summary={
                  <TableRowCount
                    count={{
                      shown: results.length,
                      total: applications.length,
                      noun: NOUN,
                      range: {
                        from: (page - 1) * REVIEW_PAGE_SIZE + 1,
                        to: Math.min(page * REVIEW_PAGE_SIZE, results.length),
                      },
                    }}
                    onClearFilters={() => {
                      update({ q: "", statuses: [] });
                      searchRef.current?.focus();
                    }}
                  />
                }
              />
            </TableCard>
          </div>
        </>
      )}
    </PageContainer>
  );
}
