import type { DbClient } from "./types";
import { fetchAllPages } from "./all-pages";
import { TABLES } from "./tables";
import type { EventRow, TeamMemberRow, TeamRow, UserInfoRow } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";

/**
 * The admin Teams view of one event: every team with its members, and the
 * numbers above the table (docs/event-states.md, "Admins: teams").
 *
 * - **Going** is everyone holding a ticket to the event.
 * - **On a team** counts the going people on a team, so it never exceeds
 *   Going; **to place** is the going people on no team.
 * - **Checked in**: a ticket holder is checked in once any of their ticket's
 *   check-ins has a time, on any of the event's check-in items. A team is
 *   "Everyone checked in" when it has at least one member holding a ticket
 *   and every member holding a ticket is checked in; a member without a
 *   ticket (rare: losing a ticket frees the team spot) is left out of it.
 * - **Full** needs a `max_team_size`; with none, no team is full.
 */
export interface EventTeamMember {
  userId: string;
  name: string;
  isOwner: boolean;
  hasTicket: boolean;
  checkedIn: boolean;
}

export interface EventTeam {
  id: string;
  /** The team's name, or its owner's: "Aubrey's team". */
  name: string;
  /** Members, the owner first and then in the order they joined. */
  members: EventTeamMember[];
  size: number;
  full: boolean;
  everyoneCheckedIn: boolean;
}

export interface EventTeamsStats {
  teams: number;
  fullTeams: number;
  /** Teams below the size limit; every team when there is no limit. */
  openTeams: number;
  onTeam: number;
  going: number;
  toPlace: number;
}

export interface EventTeamsOverview {
  teamsEnabled: boolean;
  /** Null means no limit. */
  maxTeamSize: number | null;
  /** Null means teams never lock. */
  deadline: string | null;
  /** The deadline has passed: students can no longer change teams. */
  locked: boolean;
  /** When this was read; the view measures "Locks in 3 days" from it. */
  asOf: string;
  teams: EventTeam[];
  stats: EventTeamsStats;
}

/** What `buildEventTeamsOverview` needs, as the database returns it. */
export interface EventTeamsSource {
  event: Pick<EventRow, "teams_enabled" | "max_team_size" | "team_deadline">;
  teams: (Pick<TeamRow, "id" | "name" | "owner_id"> & {
    team_members: (Pick<TeamMemberRow, "user_id" | "joined_at"> & {
      user_info: Pick<UserInfoRow, "first_name" | "last_name"> | null;
    })[];
  })[];
  tickets: { user_id: string; check_ins: { checked_in_at: string | null }[] }[];
}

function memberName(info: Pick<UserInfoRow, "first_name" | "last_name"> | null): string {
  const name = formatUserName({
    first_name: info?.first_name ?? "",
    last_name: info?.last_name ?? "",
  });
  return name || "Unknown User";
}

/** The overview from rows already read. Pure, so the rules are unit-tested. */
export function buildEventTeamsOverview(
  source: EventTeamsSource,
  now: Date = new Date()
): EventTeamsOverview {
  const { event } = source;
  const maxTeamSize = event.max_team_size;
  const checkedInByUser = new Map<string, boolean>();
  for (const ticket of source.tickets) {
    const checkedIn = ticket.check_ins.some((checkIn) => checkIn.checked_in_at !== null);
    checkedInByUser.set(ticket.user_id, (checkedInByUser.get(ticket.user_id) ?? false) || checkedIn);
  }

  const onTeam = new Set<string>();
  const teams = source.teams.map((team): EventTeam => {
    const members = team.team_members
      .map((member) => ({
        userId: member.user_id,
        name: memberName(member.user_info),
        firstName: member.user_info?.first_name?.trim() ?? "",
        isOwner: member.user_id === team.owner_id,
        joinedAt: member.joined_at,
        hasTicket: checkedInByUser.has(member.user_id),
        checkedIn: checkedInByUser.get(member.user_id) ?? false,
      }))
      .sort(
        (a, b) =>
          Number(b.isOwner) - Number(a.isOwner) ||
          a.joinedAt.localeCompare(b.joinedAt) ||
          a.userId.localeCompare(b.userId)
      );
    const holders = members.filter((member) => member.hasTicket);
    for (const holder of holders) onTeam.add(holder.userId);
    const owner = members.find((member) => member.isOwner);
    const name =
      team.name?.trim() ||
      (owner?.firstName ? `${owner.firstName}'s team` : "Unnamed team");

    return {
      id: team.id,
      name,
      members: members.map(({ userId, name, isOwner, hasTicket, checkedIn }) => ({
        userId,
        name,
        isOwner,
        hasTicket,
        checkedIn,
      })),
      size: members.length,
      full: maxTeamSize !== null && members.length >= maxTeamSize,
      everyoneCheckedIn: holders.length > 0 && holders.every((member) => member.checkedIn),
    };
  });

  const fullTeams = teams.filter((team) => team.full).length;
  const going = checkedInByUser.size;
  return {
    teamsEnabled: event.teams_enabled,
    maxTeamSize,
    deadline: event.team_deadline,
    locked:
      event.team_deadline !== null &&
      now.getTime() >= new Date(event.team_deadline).getTime(),
    asOf: now.toISOString(),
    teams,
    stats: {
      teams: teams.length,
      fullTeams,
      openTeams: teams.length - fullTeams,
      onTeam: onTeam.size,
      going,
      toPlace: going - onTeam.size,
    },
  };
}

/**
 * The admin Teams view of an event, or null when there is no such event. Use
 * the admin's viewer client: RLS lets admins and managers read every team,
 * member, ticket and check-in, and members' names in `user_info`.
 */
export async function fetchEventTeamsOverview(
  client: DbClient,
  eventId: string,
  now: Date = new Date()
): Promise<EventTeamsOverview | null> {
  const { data: event, error } = await client
    .from(TABLES.events)
    .select("teams_enabled, max_team_size, team_deadline")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!event) return null;

  const [teams, tickets] = await Promise.all([
    fetchAllPages<EventTeamsSource["teams"][number]>((from, to) =>
      client
        .from(TABLES.teams)
        .select("id, name, owner_id, team_members(user_id, joined_at, user_info(first_name, last_name))")
        .eq("event_id", eventId)
        .order("id")
        .range(from, to)
    ),
    fetchAllPages<EventTeamsSource["tickets"][number]>((from, to) =>
      client
        .from(TABLES.eventTickets)
        .select("user_id, check_ins(checked_in_at)")
        .eq("event_id", eventId)
        .order("id")
        .range(from, to)
    ),
  ]);

  return buildEventTeamsOverview({ event, teams, tickets }, now);
}
