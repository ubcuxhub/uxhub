import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/supabase/models";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { fetchTeamByInviteCode, fetchUserTeam } from "@/lib/supabase-helpers/teams";
import type { DbClient } from "@/lib/supabase-helpers/types";

import type { TeamCardProps } from "../components/teams/TeamCard";
import { TEAM_FAILURE_MESSAGES, parseInviteCode, teamsLocked } from "./teams";
import { toTeamInvite, toTeamView, type TeamInvite } from "./team-view";

export type TeamCardData =
  | { show: true; props: TeamCardProps }
  /** No ticket, so no card; `inviteError` says why an opened invite link can't be used. */
  | { show: false; inviteError: string | null };

/**
 * What the portal event page needs for "Your team": the student's team, and
 * the team behind an invite link they opened (`?join=<code>`), or why they
 * can't join it. Only for events with teams; the caller checks
 * `teams_enabled`.
 *
 * Team members' names live in `user_info`, which RLS keeps private, so the
 * teams are read with the service role. `supabase` is the student's own
 * client, for their ticket.
 */
export async function loadTeamCard(input: {
  supabase: DbClient;
  event: Pick<EventRow, "id" | "name" | "max_team_size" | "team_deadline">;
  userId: string;
  joinCode: string | null;
  origin: string;
}): Promise<TeamCardData> {
  const { supabase, event, userId, joinCode, origin } = input;
  const inviteCode = joinCode ? parseInviteCode(joinCode) : null;

  const [ticket, userTeam, invitedTeam] = await Promise.all([
    fetchUserEventTicket(supabase, event.id, userId),
    fetchUserTeam(supabaseAdmin, event.id, userId),
    inviteCode ? fetchTeamByInviteCode(supabaseAdmin, inviteCode) : null,
  ]);
  const locked = teamsLocked(event.team_deadline);

  let invite: TeamInvite | null = null;
  let inviteError: string | null = null;
  if (joinCode) {
    if (!invitedTeam || invitedTeam.event_id !== event.id) {
      inviteError = TEAM_FAILURE_MESSAGES.TEAM_NOT_FOUND;
    } else if (!ticket) {
      inviteError = `Register for ${event.name} first, then open the invite link again.`;
    } else if (locked) {
      inviteError = TEAM_FAILURE_MESSAGES.TEAMS_LOCKED;
    } else if (userTeam) {
      inviteError =
        userTeam.id === invitedTeam.id
          ? "You're already on this team."
          : TEAM_FAILURE_MESSAGES.ALREADY_ON_TEAM;
    } else if (event.max_team_size !== null && invitedTeam.members.length >= event.max_team_size) {
      inviteError = TEAM_FAILURE_MESSAGES.TEAM_FULL;
    } else {
      invite = toTeamInvite(invitedTeam, event);
    }
  }

  if (!ticket) return { show: false, inviteError };
  return {
    show: true,
    props: {
      eventId: event.id,
      maxTeamSize: event.max_team_size,
      teamDeadline: event.team_deadline,
      locked,
      team: userTeam ? toTeamView(userTeam, userId) : null,
      origin,
      invite,
      inviteError,
    },
  };
}
