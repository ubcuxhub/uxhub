import type {
  EventTeam,
  EventTeamsOverview,
} from "@/lib/supabase-helpers/event-teams";
import { formatEventDate } from "@/lib/date";

/** Teams per page. */
export const TEAMS_PAGE_SIZE = 25;

export type TeamSort = "name" | "name-desc" | "largest" | "smallest";
export const DEFAULT_TEAM_SORT: TeamSort = "name";
export const TEAM_SORTS: readonly { value: TeamSort; label: string }[] = [
  { value: "name", label: "Team name (A–Z)" },
  { value: "name-desc", label: "Team name (Z–A)" },
  { value: "largest", label: "Largest teams first" },
  { value: "smallest", label: "Smallest teams first" },
];

/** The check-in filter: whether every ticket holder on the team is in. */
export type TeamCheckInFilter = "everyone" | "not-everyone";
export const TEAM_CHECK_IN_OPTIONS: readonly {
  value: TeamCheckInFilter;
  label: string;
}[] = [
  { value: "everyone", label: "Everyone checked in" },
  { value: "not-everyone", label: "Not everyone checked in" },
];

/**
 * The list's view state, in the URL (`?q=pixel&sort=largest&size=3,4&
 * checkin=not-everyone&page=2`). Values within a filter are alternatives;
 * the filters and the search intersect. An empty filter doesn't filter.
 */
export interface TeamsListQuery {
  q: string;
  sort: TeamSort;
  /** Team sizes, as strings ("3"), to sit in a chip group. */
  sizes: string[];
  checkIns: TeamCheckInFilter[];
  page: number;
}

export const EMPTY_TEAM_FILTERS: Pick<TeamsListQuery, "sizes" | "checkIns"> = {
  sizes: [],
  checkIns: [],
};

/** The query keys this list owns; `serializeTeamsListQuery` keeps any other. */
const KEYS = ["q", "sort", "size", "checkin", "page"] as const;

type ParamSource = { get(name: string): string | null };

function listParam(params: ParamSource, name: string): string[] {
  const raw = params.get(name);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
}

export function parseTeamsListQuery(params: ParamSource): TeamsListQuery {
  const rawSort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const checkIns = listParam(params, "checkin");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    sort: TEAM_SORTS.find((option) => option.value === rawSort)?.value ?? DEFAULT_TEAM_SORT,
    sizes: listParam(params, "size")
      .filter((value) => /^[1-9]\d?$/.test(value))
      .sort((a, b) => Number(a) - Number(b)),
    checkIns: TEAM_CHECK_IN_OPTIONS.map((option) => option.value).filter((value) =>
      checkIns.includes(value)
    ),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/**
 * The query string (with its `?`, or empty) for a view, over `base`: the
 * list's own keys are rewritten, defaults left out, and any other key (a
 * tab, say) kept.
 */
export function serializeTeamsListQuery(
  query: TeamsListQuery,
  base: string | URLSearchParams = ""
): string {
  const params = new URLSearchParams(base);
  for (const key of KEYS) params.delete(key);
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.sort !== DEFAULT_TEAM_SORT) params.set("sort", query.sort);
  if (query.sizes.length) params.set("size", query.sizes.join(","));
  if (query.checkIns.length) params.set("checkin", query.checkIns.join(","));
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** How many filter values are on, for "Sort and filter · 2". */
export function countTeamFilters(query: Pick<TeamsListQuery, "sizes" | "checkIns">): number {
  return query.sizes.length + query.checkIns.length;
}

/**
 * The team size chips: 1 to the size limit, the last marked full. With no
 * limit, 1 to the largest team. A size the URL asked for that is out of
 * range is kept, so it can be cleared.
 */
export function teamSizeOptions(
  maxTeamSize: number | null,
  teams: readonly Pick<EventTeam, "size">[],
  selected: readonly string[] = []
): { value: string; label: string }[] {
  const largest = Math.max(1, ...teams.map((team) => team.size));
  const top = Math.max(maxTeamSize ?? largest, 1);
  const sizes = new Set<number>();
  for (let size = 1; size <= top; size += 1) sizes.add(size);
  for (const value of selected) sizes.add(Number(value));
  return [...sizes]
    .sort((a, b) => a - b)
    .map((size) => ({
      value: String(size),
      label: `${size} ${size === 1 ? "member" : "members"}${size === maxTeamSize ? " (full)" : ""}`,
    }));
}

const byName = (a: EventTeam, b: EventTeam) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

function compareTeams(sort: TeamSort) {
  return (a: EventTeam, b: EventTeam) => {
    const result =
      sort === "name-desc"
        ? byName(b, a)
        : sort === "largest"
          ? b.size - a.size || byName(a, b)
          : sort === "smallest"
            ? a.size - b.size || byName(a, b)
            : byName(a, b);
    return result || a.id.localeCompare(b.id);
  };
}

/** The teams a view shows: searched by team or member name, filtered, sorted. */
export function filterTeams<T extends EventTeam>(
  teams: readonly T[],
  query: Pick<TeamsListQuery, "q" | "sort" | "sizes" | "checkIns">
): T[] {
  const needle = query.q.trim().toLocaleLowerCase("en");
  return teams
    .filter(
      (team) =>
        (!needle ||
          [team.name, ...team.members.map((member) => member.name)].some((name) =>
            name.toLocaleLowerCase("en").includes(needle)
          )) &&
        (query.sizes.length === 0 || query.sizes.includes(String(team.size))) &&
        (query.checkIns.length === 0 ||
          query.checkIns.includes(team.everyoneCheckedIn ? "everyone" : "not-everyone"))
    )
    .sort(compareTeams(query.sort));
}

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

/** The three stat cards' values and the line under each. */
export function teamsSummary(
  overview: Pick<EventTeamsOverview, "stats" | "maxTeamSize" | "deadline" | "locked" | "asOf">
) {
  const { stats } = overview;
  return {
    teams:
      overview.maxTeamSize === null
        ? "No size limit"
        : `${stats.fullTeams} full · ${stats.openTeams} with open spots`,
    onTeam: `of ${stats.going} going · ${stats.toPlace} to place`,
    deadline: deadlineSummary(overview),
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "Jan 10" with "Passed · teams are locked", or "Locks in 3 days". */
export function deadlineSummary({
  deadline,
  locked,
  asOf,
}: Pick<EventTeamsOverview, "deadline" | "locked" | "asOf">): {
  value: string;
  detail: string;
} {
  if (!deadline) return { value: "None", detail: "Teams never lock" };
  const value = formatEventDate(deadline, { month: "short", year: undefined }) ?? deadline;
  if (locked) return { value, detail: "Passed · teams are locked" };
  const left = new Date(deadline).getTime() - new Date(asOf).getTime();
  const detail =
    left >= DAY
      ? `Locks in ${plural(Math.floor(left / DAY), "day", "days")}`
      : left >= HOUR
        ? `Locks in ${plural(Math.floor(left / HOUR), "hour", "hours")}`
        : "Locks in under an hour";
  return { value, detail };
}
