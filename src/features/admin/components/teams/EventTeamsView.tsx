"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UsersRound } from "lucide-react";

import {
  SortFilterPanel,
  SortFilterSection,
} from "@/components/shared/SortFilterPanel";
import { TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { EmptyState } from "@/components/ui/empty-state";
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
} from "@/components/ui/table";
import { ChipFilterSection } from "@/features/admin/components/ChipFilterSection";
import type { EventTeamsOverview } from "@/lib/supabase-helpers/event-teams";

import {
  DEFAULT_TEAM_SORT,
  EMPTY_TEAM_FILTERS,
  TEAMS_PAGE_SIZE,
  TEAM_CHECK_IN_OPTIONS,
  TEAM_SORTS,
  countTeamFilters,
  filterTeams,
  parseTeamsListQuery,
  serializeTeamsListQuery,
  teamSizeOptions,
  teamsSummary,
  type TeamCheckInFilter,
  type TeamSort,
  type TeamsListQuery,
} from "./teams-list";

export interface EventTeamsViewProps {
  /** From `fetchEventTeamsOverview`, read with the admin's client. */
  overview: EventTeamsOverview;
  /** Teams per page; 25 unless a demo wants fewer. */
  pageSize?: number;
}

const NOUN = { one: "team", other: "teams" };

const toggled = <T extends string>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * The view state lives in the URL, as on the application review list, so
 * back, refresh and sharing keep it. Changes use `history.replaceState`,
 * which Next folds into `useSearchParams` without a server round trip; any
 * query key the list doesn't own is kept. Changing anything but the page
 * goes back to page 1.
 */
function useTeamsListQuery() {
  const searchParams = useSearchParams();
  const urlKey = searchParams?.toString() ?? "";
  const [state, setState] = useState(() => ({
    seen: urlKey,
    written: urlKey,
    query: parseTeamsListQuery(new URLSearchParams(urlKey)),
  }));

  let query = state.query;
  // Back and forward change the URL under us; adopt it. Our own writes arrive
  // here too, once Next catches up, and are already in `query`.
  if (state.seen !== urlKey) {
    if (urlKey !== state.written) {
      query = parseTeamsListQuery(new URLSearchParams(urlKey));
    }
    setState({ seen: urlKey, written: state.written, query });
  }

  const update = (patch: Partial<TeamsListQuery>) => {
    const next: TeamsListQuery = { ...query, page: 1, ...patch };
    const search = serializeTeamsListQuery(next, window.location.search);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}${window.location.hash}`
    );
    setState({ seen: state.seen, written: search.slice(1), query: next });
  };

  return [query, update] as const;
}

/**
 * An event's teams for UX Hub execs (Figma "Manage Events", Teams tab): how
 * many teams there are and how full, who is still to place, the team
 * deadline, then every team and its members, searchable, sortable and
 * filterable by size and check-in.
 */
export function EventTeamsView({ overview, pageSize = TEAMS_PAGE_SIZE }: EventTeamsViewProps) {
  const [query, update] = useTeamsListQuery();
  const searchRef = useRef<HTMLInputElement>(null);

  const { teams, stats, maxTeamSize } = overview;
  const summary = teamsSummary(overview);
  const results = filterTeams(teams, query);
  const page = clampPage(query.page, pageSize, results.length);
  const rows = results.slice((page - 1) * pageSize, page * pageSize);
  const memberColumns = Math.max(
    1,
    maxTeamSize ?? 0,
    ...teams.map((team) => team.size)
  );
  const sizes = teamSizeOptions(maxTeamSize, teams, query.sizes);
  const filterCount = countTeamFilters(query);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Teams summary" className="grid gap-3 sm:grid-cols-3">
        <StatCard kind="value" label="Teams" value={stats.teams} detail={summary.teams} />
        <StatCard kind="value" label="On a team" value={stats.onTeam} detail={summary.onTeam} />
        <StatCard
          kind="value"
          label="Team deadline"
          value={summary.deadline.value}
          detail={summary.deadline.detail}
        />
      </section>

      {teams.length === 0 ? (
        <TableCard>
          <EmptyState
            size="page"
            icon={<UsersRound aria-hidden />}
            title="No teams yet"
            description={
              !overview.teamsEnabled
                ? "Teams are off for this event. Turn them on in the event builder's Teams section."
                : overview.locked
                  ? "Teams are locked and nobody made one before the deadline."
                  : "Teams show up here once people with a ticket create or join one."
            }
          />
        </TableCard>
      ) : (
        <div className="flex flex-col gap-4">
          <TableToolbar
            search={
              <SearchField
                ref={searchRef}
                label="Search teams or people"
                placeholder="Search teams or people"
                value={query.q}
                onValueChange={(q) => update({ q })}
              />
            }
            actions={
              <SortFilterPanel
                activeCount={filterCount + (query.sort === DEFAULT_TEAM_SORT ? 0 : 1)}
                summary={`${results.length} ${results.length === 1 ? NOUN.one : NOUN.other}`}
                onClearAll={() => update({ sort: DEFAULT_TEAM_SORT, ...EMPTY_TEAM_FILTERS })}
                className="max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
              >
                <SortFilterSection title="Sort by">
                  <Select
                    value={query.sort}
                    onValueChange={(sort) => update({ sort: sort as TeamSort })}
                  >
                    <SelectTrigger aria-label="Sort by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_SORTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SortFilterSection>
                <ChipFilterSection
                  title="Team size"
                  options={sizes}
                  selected={new Set(query.sizes)}
                  onToggle={(value) =>
                    update({
                      sizes: toggled(query.sizes, value).sort((a, b) => Number(a) - Number(b)),
                    })
                  }
                />
                <ChipFilterSection<TeamCheckInFilter>
                  title="Check-in"
                  options={TEAM_CHECK_IN_OPTIONS}
                  selected={new Set(query.checkIns)}
                  onToggle={(value) =>
                    update({
                      checkIns: TEAM_CHECK_IN_OPTIONS.map((option) => option.value).filter(
                        (candidate) =>
                          candidate === value
                            ? !query.checkIns.includes(candidate)
                            : query.checkIns.includes(candidate)
                      ),
                    })
                  }
                />
              </SortFilterPanel>
            }
          />

          <TableCard>
            <Table stickyFirstColumn scrollerLabel="Teams" className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48 min-w-40">Team</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  {Array.from({ length: memberColumns }, (_, index) => (
                    <TableHead key={index}>Member {index + 1}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={memberColumns + 2}>
                    No teams match your search and filters.
                  </TableEmpty>
                ) : (
                  rows.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium text-foreground">{team.name}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {maxTeamSize === null ? team.size : `${team.size} of ${maxTeamSize}`}
                      </TableCell>
                      {Array.from({ length: memberColumns }, (_, index) => {
                        const member = team.members[index];
                        return (
                          <TableCell key={index} className="whitespace-nowrap">
                            {member ? member.name : <TableNone />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={results.length}
              onPageChange={(next) => {
                if (next !== query.page) update({ page: next });
              }}
              summary={
                <TableRowCount
                  count={{
                    shown: results.length,
                    total: teams.length,
                    noun: NOUN,
                    range: {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, results.length),
                    },
                  }}
                  onClearFilters={() => {
                    update({ q: "", ...EMPTY_TEAM_FILTERS });
                    searchRef.current?.focus();
                  }}
                />
              }
            />
          </TableCard>
        </div>
      )}
    </div>
  );
}
