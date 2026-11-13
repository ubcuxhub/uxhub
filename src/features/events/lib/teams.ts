import { formatEventDate, formatEventTime } from "@/lib/date";
import type { TeamFailureReason, TeamMember, TeamWithMembers } from "@/lib/supabase-helpers/teams";

/** Longest team name the dialogs accept. */
export const TEAM_NAME_MAX_LENGTH = 60;

/** Where an invite link points: `/join/<code>`. */
export function inviteLinkPath(inviteCode: string): string {
  return `/join/${encodeURIComponent(inviteCode)}`;
}

/** The link without its scheme, as the card prints it: "ubcuxhub.ca/join/8f2kq01ab3". */
export function displayInviteLink(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * The invite code in what someone pasted into "Join a team": a full link
 * (with or without the scheme, query or trailing slash), or the bare code.
 * Null when there's nothing that could be a code.
 */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromLink = /\/join\/([^/?#\s]+)/i.exec(trimmed);
  const code = fromLink ? fromLink[1] : trimmed;
  let decoded: string;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    return null;
  }
  return /^[a-z0-9-]{4,64}$/i.test(decoded) ? decoded.toLowerCase() : null;
}

/** "Jordan Lee", or "Teammate" for a member whose profile has no name. */
export function memberName(member: Pick<TeamMember, "firstName" | "lastName">): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
  return name || "Teammate";
}

/**
 * The team's name, or for a team left unnamed, its owner's: "Aubrey's team".
 * A team admins made has no owner, so it falls back to "Your team".
 */
export function teamDisplayName(team: Pick<TeamWithMembers, "name" | "members">): string {
  if (team.name) return team.name;
  const owner = team.members.find((member) => member.isOwner);
  const firstName = owner?.firstName?.trim();
  return firstName ? `${firstName}'s team` : "Your team";
}

/** "3 of 4 members", or "3 members" when the event sets no limit. */
export function memberCountLabel(count: number, max: number | null): string {
  if (max !== null) return `${count} of ${max} members`;
  return `${count} ${count === 1 ? "member" : "members"}`;
}

/**
 * What the card says under the team name while teams are open: how many
 * spots are left, or that the team is full. Null when the event sets no limit.
 */
export function spotsLeftLabel(count: number, max: number | null): string | null {
  if (max === null) return null;
  const left = max - count;
  if (left <= 0) return "Your team is full.";
  return left === 1
    ? "1 spot left. Share the invite link to fill it."
    : `${left} spots left. Share the invite link to fill them.`;
}

/** "Nov 13 at 11:59 PM", in Pacific time. */
export function formatTeamDeadline(deadline: string): string {
  const date = formatEventDate(deadline, { month: "short", day: "numeric", year: undefined });
  const time = formatEventTime(deadline);
  return time ? `${date} at ${time}` : (date ?? deadline);
}

/** Whether teams have locked: the deadline has passed. No deadline never locks. */
export function teamsLocked(deadline: string | null, now: number = Date.now()): boolean {
  return deadline !== null && new Date(deadline).getTime() <= now;
}

/** What a refused team action tells the student. */
export const TEAM_FAILURE_MESSAGES: Record<TeamFailureReason, string> = {
  EVENT_NOT_FOUND: "This event couldn't be found.",
  TEAMS_DISABLED: "This event doesn't have teams.",
  NO_TICKET: "Register for this event first, then you can join a team.",
  TEAMS_LOCKED: "Teams are locked, so they can't be changed anymore.",
  ALREADY_ON_TEAM: "You're already on a team for this event. Leave it first to join another.",
  TEAM_NOT_FOUND: "That invite link doesn't work anymore. Ask your teammate for a new one.",
  TEAM_FULL: "That team is full. Ask for another team's link, or create your own.",
  NOT_ON_TEAM: "You're not on a team for this event.",
  OWNER_CANNOT_LEAVE: "You own this team, so you can delete it instead of leaving.",
  NOT_OWNER: "Only the team's owner can do that.",
};

/** For a failure nobody planned for, such as a dropped connection. */
export const TEAM_UNEXPECTED_ERROR = "Something went wrong. Try again.";
