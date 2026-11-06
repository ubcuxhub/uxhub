import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { TeamRow, UserInfoRow } from "@/lib/supabase/models";

/**
 * Why a team action was refused, from the team functions in
 * `supabase/migrations/*_event_teams.sql`.
 */
export type TeamFailureReason =
  | "EVENT_NOT_FOUND"
  | "TEAMS_DISABLED"
  | "NO_TICKET"
  | "TEAMS_LOCKED"
  | "ALREADY_ON_TEAM"
  | "TEAM_NOT_FOUND"
  | "TEAM_FULL"
  | "NOT_ON_TEAM"
  | "OWNER_CANNOT_LEAVE"
  | "NOT_OWNER";

export interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  isOwner: boolean;
  joinedAt: string;
}

/** A team with its members, the owner first and then in the order they joined. */
export type TeamWithMembers = Pick<TeamRow, "id" | "event_id" | "name" | "invite_code" | "owner_id"> & {
  members: TeamMember[];
};

type TeamQueryRow = Pick<TeamRow, "id" | "event_id" | "name" | "invite_code" | "owner_id"> & {
  team_members: {
    user_id: string;
    joined_at: string;
    user_info: Pick<UserInfoRow, "first_name" | "last_name"> | null;
  }[];
};

const TEAM_SELECT =
  "id, event_id, name, invite_code, owner_id, team_members(user_id, joined_at, user_info(first_name, last_name))";

function toTeamWithMembers(row: TeamQueryRow): TeamWithMembers {
  const { team_members, ...team } = row;
  const members = team_members
    .map((member) => ({
      userId: member.user_id,
      firstName: member.user_info?.first_name ?? null,
      lastName: member.user_info?.last_name ?? null,
      isOwner: member.user_id === team.owner_id,
      joinedAt: member.joined_at,
    }))
    .sort(
      (a, b) =>
        Number(b.isOwner) - Number(a.isOwner) || a.joinedAt.localeCompare(b.joinedAt)
    );
  return { ...team, members };
}

/**
 * The user's team for an event, with every member's name, or null. Service
 * role only: a member's name comes from `user_info`, which RLS keeps private.
 */
export async function fetchUserTeam(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<TeamWithMembers | null> {
  const { data: membership, error: membershipError } = await supabase
    .from(TABLES.teamMembers)
    .select("team_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data, error } = await supabase
    .from(TABLES.teams)
    .select(TEAM_SELECT)
    .eq("id", membership.team_id)
    .single();
  if (error) throw error;
  return toTeamWithMembers(data as TeamQueryRow);
}

/**
 * The team an invite link points at, for the "Join [team]?" dialog, or null.
 * Service role only, as for `fetchUserTeam`.
 */
export async function fetchTeamByInviteCode(
  supabase: DbClient,
  inviteCode: string
): Promise<TeamWithMembers | null> {
  const { data, error } = await supabase
    .from(TABLES.teams)
    .select(TEAM_SELECT)
    .eq("invite_code", inviteCode.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? toTeamWithMembers(data as TeamQueryRow) : null;
}

/** Creates a team owned by the user, who becomes its first member. Service role only. */
export async function createTeam(
  supabase: DbClient,
  input: { eventId: string; userId: string; name?: string | null }
): Promise<{ teamId: string | null; failureReason: TeamFailureReason | null }> {
  const { data, error } = await supabase.rpc("create_team", {
    p_event_id: input.eventId,
    p_user_id: input.userId,
    p_name: input.name ?? undefined,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    teamId: row?.team_id ?? null,
    failureReason: (row?.failure_reason as TeamFailureReason | null) ?? null,
  };
}

/** Adds the user to the team with this invite code, if it has room. Service role only. */
export async function joinTeam(
  supabase: DbClient,
  input: { inviteCode: string; userId: string }
): Promise<{ teamId: string | null; failureReason: TeamFailureReason | null }> {
  const { data, error } = await supabase.rpc("join_team", {
    p_invite_code: input.inviteCode,
    p_user_id: input.userId,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    teamId: row?.team_id ?? null,
    failureReason: (row?.failure_reason as TeamFailureReason | null) ?? null,
  };
}

/** Takes a member off their team for the event; an owner deletes it instead. Service role only. */
export async function leaveTeam(
  supabase: DbClient,
  input: { eventId: string; userId: string }
): Promise<TeamFailureReason | null> {
  const { data, error } = await supabase.rpc("leave_team", {
    p_event_id: input.eventId,
    p_user_id: input.userId,
  });
  if (error) throw error;
  return (data as TeamFailureReason | null) ?? null;
}

/** Deletes the owner's team and removes everyone on it. Service role only. */
export async function deleteTeam(
  supabase: DbClient,
  input: { teamId: string; userId: string }
): Promise<TeamFailureReason | null> {
  const { data, error } = await supabase.rpc("delete_team", {
    p_team_id: input.teamId,
    p_user_id: input.userId,
  });
  if (error) throw error;
  return (data as TeamFailureReason | null) ?? null;
}
