import type { TeamWithMembers } from "@/lib/supabase-helpers/teams";

import { memberName, teamDisplayName } from "./teams";

/**
 * What the "Join [team]?" dialog shows (7.5): the team, who's on it, and how
 * full it is. Built on the server from the team behind an invite code, so the
 * browser never sees the teammates' user ids.
 */
export interface TeamInvite {
  inviteCode: string;
  teamName: string;
  eventName: string;
  /** Null for a team admins made, which has no owner. */
  ownerName: string | null;
  members: { name: string; isOwner: boolean }[];
  maxSize: number | null;
}

export function toTeamInvite(
  team: TeamWithMembers,
  event: { name: string; max_team_size: number | null }
): TeamInvite {
  const owner = team.members.find((member) => member.isOwner);
  return {
    inviteCode: team.invite_code,
    teamName: teamDisplayName(team),
    eventName: event.name,
    ownerName: owner ? memberName(owner) : null,
    members: team.members.map((member) => ({ name: memberName(member), isOwner: member.isOwner })),
    maxSize: event.max_team_size,
  };
}

/** The signed-in student's team, as the card shows it. */
export interface TeamView {
  id: string;
  /** What the card and dialogs call it: its name, or "Aubrey's team". */
  displayName: string;
  /** The name as saved, for the rename field; null when unnamed. */
  name: string | null;
  inviteCode: string;
  /** Whether the signed-in student owns it. */
  isOwner: boolean;
  /** Owner first, then in the order they joined. */
  members: { key: string; name: string; isOwner: boolean; isYou: boolean }[];
}

export function toTeamView(team: TeamWithMembers, currentUserId: string): TeamView {
  return {
    id: team.id,
    displayName: teamDisplayName(team),
    name: team.name,
    inviteCode: team.invite_code,
    isOwner: team.owner_id === currentUserId,
    members: team.members.map((member, index) => ({
      key: String(index),
      name: memberName(member),
      isOwner: member.isOwner,
      isYou: member.userId === currentUserId,
    })),
  };
}

/**
 * "Jordan Lee invited you to their Design Sprint team. 2 of 4 spots are taken."
 */
export function inviteDescription(invite: TeamInvite): string {
  const who = invite.ownerName
    ? `${invite.ownerName} invited you to their ${invite.eventName} team.`
    : `You've been invited to a ${invite.eventName} team.`;
  if (invite.maxSize === null) return who;
  return `${who} ${invite.members.length} of ${invite.maxSize} spots are taken.`;
}

/** "You're on a team with Jordan Lee and Sam Chen." for the "You joined" toast (7.7). */
export function joinedDescription(invite: TeamInvite): string {
  const names = invite.members.map((member) => member.name);
  if (names.length === 0) return "You're the first one on the team.";
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `You're on a team with ${list}.`;
}
