"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createTeam,
  deleteTeam,
  fetchTeamByInviteCode,
  joinTeam,
  leaveTeam,
  renameTeam,
  type TeamFailureReason,
} from "@/lib/supabase-helpers/teams";
import { TABLES } from "@/lib/supabase-helpers/tables";

import {
  TEAM_FAILURE_MESSAGES,
  TEAM_NAME_MAX_LENGTH,
  TEAM_UNEXPECTED_ERROR,
  parseInviteCode,
} from "./lib/teams";
import { toTeamInvite, type TeamInvite } from "./lib/team-view";

/**
 * Team actions for the portal event page (Figma "Teams", 7.1–7.11). Students
 * never write the team tables themselves: each action passes the signed-in
 * user to a database function that checks the ticket, the deadline and the
 * size limit, which runs as the service role.
 */

export type TeamActionResult =
  | { ok: true }
  | { ok: false; error: string; reason?: TeamFailureReason };

export type CreateTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; error: string; reason?: TeamFailureReason };

export type PreviewTeamResult =
  | { ok: true; invite: TeamInvite }
  | { ok: false; error: string; reason?: TeamFailureReason };

const INVALID_LINK = "That doesn't look like a team invite link. Check it and try again.";
const OTHER_EVENT = "That invite link is for a different event.";
const NAME_TOO_LONG = `Keep the team name under ${TEAM_NAME_MAX_LENGTH} characters.`;

function refused(reason: TeamFailureReason) {
  return { ok: false, error: TEAM_FAILURE_MESSAGES[reason], reason } as const;
}

function failed(event: string, fields: Record<string, string>, error: unknown) {
  log.error(event, { ...fields, ...errorFields(error) });
  return { ok: false, error: TEAM_UNEXPECTED_ERROR } as const;
}

/** Every portal event page, since the actions know the event by id, not slug. */
function revalidateEventPages() {
  revalidatePath("/portal/events/[event]", "page");
}

function parseName(name: unknown): { ok: true; name: string | null } | { ok: false; error: string } {
  if (name !== null && name !== undefined && typeof name !== "string") {
    return { ok: false, error: TEAM_UNEXPECTED_ERROR };
  }
  const trimmed = (name ?? "").trim();
  if (trimmed.length > TEAM_NAME_MAX_LENGTH) return { ok: false, error: NAME_TOO_LONG };
  return { ok: true, name: trimmed || null };
}

/** Creates a team the student owns (7.1). */
export async function createTeamAction(input: {
  eventId: string;
  name?: string | null;
}): Promise<CreateTeamResult> {
  const user = await requireAuth();
  const parsed = parseName(input?.name);
  if (!parsed.ok) return parsed;
  if (typeof input?.eventId !== "string") return refused("EVENT_NOT_FOUND");

  try {
    const { teamId, failureReason } = await createTeam(supabaseAdmin, {
      eventId: input.eventId,
      userId: user.id,
      name: parsed.name,
    });
    if (failureReason || !teamId) return refused(failureReason ?? "EVENT_NOT_FOUND");
    log.info("team.created", { teamId, eventId: input.eventId, userId: user.id });
    revalidateEventPages();
    return { ok: true, teamId };
  } catch (error) {
    return failed("team.create_failed", { eventId: input.eventId, userId: user.id }, error);
  }
}

/**
 * The team behind a pasted invite link, for the "Join [team]?" step (7.5).
 * Refuses a link for another event, or a team with no room, before the
 * student is asked to confirm.
 */
export async function previewTeamAction(input: {
  eventId: string;
  link: string;
}): Promise<PreviewTeamResult> {
  const user = await requireAuth();
  const inviteCode = typeof input?.link === "string" ? parseInviteCode(input.link) : null;
  if (!inviteCode) return { ok: false, error: INVALID_LINK };

  try {
    const team = await fetchTeamByInviteCode(supabaseAdmin, inviteCode);
    if (!team) return refused("TEAM_NOT_FOUND");
    if (team.event_id !== input.eventId) return { ok: false, error: OTHER_EVENT };

    const { data: event, error } = await supabaseAdmin
      .from(TABLES.events)
      .select("name, max_team_size")
      .eq("id", team.event_id)
      .single();
    if (error) throw error;

    const invite = toTeamInvite(team, event);
    if (invite.maxSize !== null && invite.members.length >= invite.maxSize) return refused("TEAM_FULL");
    return { ok: true, invite };
  } catch (error) {
    return failed("team.preview_failed", { eventId: input.eventId, userId: user.id }, error);
  }
}

/** Joins the team with this invite code (7.7). */
export async function joinTeamAction(input: { inviteCode: string }): Promise<TeamActionResult> {
  const user = await requireAuth();
  const inviteCode = typeof input?.inviteCode === "string" ? parseInviteCode(input.inviteCode) : null;
  if (!inviteCode) return { ok: false, error: INVALID_LINK };

  try {
    const { teamId, failureReason } = await joinTeam(supabaseAdmin, { inviteCode, userId: user.id });
    if (failureReason || !teamId) return refused(failureReason ?? "TEAM_NOT_FOUND");
    log.info("team.joined", { teamId, userId: user.id });
    revalidateEventPages();
    return { ok: true };
  } catch (error) {
    return failed("team.join_failed", { userId: user.id }, error);
  }
}

/** Renames the owner's team; a blank name clears it. */
export async function renameTeamAction(input: {
  teamId: string;
  name: string | null;
}): Promise<TeamActionResult> {
  const user = await requireAuth();
  const parsed = parseName(input?.name);
  if (!parsed.ok) return parsed;
  if (typeof input?.teamId !== "string") return refused("TEAM_NOT_FOUND");

  try {
    const reason = await renameTeam(supabaseAdmin, {
      teamId: input.teamId,
      userId: user.id,
      name: parsed.name,
    });
    if (reason) return refused(reason);
    revalidateEventPages();
    return { ok: true };
  } catch (error) {
    return failed("team.rename_failed", { teamId: input.teamId, userId: user.id }, error);
  }
}

/** Takes a member off their team (7.9). */
export async function leaveTeamAction(input: { eventId: string }): Promise<TeamActionResult> {
  const user = await requireAuth();
  if (typeof input?.eventId !== "string") return refused("EVENT_NOT_FOUND");

  try {
    const reason = await leaveTeam(supabaseAdmin, { eventId: input.eventId, userId: user.id });
    if (reason) return refused(reason);
    log.info("team.left", { eventId: input.eventId, userId: user.id });
    revalidateEventPages();
    return { ok: true };
  } catch (error) {
    return failed("team.leave_failed", { eventId: input.eventId, userId: user.id }, error);
  }
}

/** Deletes the owner's team and removes everyone on it (7.4). */
export async function deleteTeamAction(input: { teamId: string }): Promise<TeamActionResult> {
  const user = await requireAuth();
  if (typeof input?.teamId !== "string") return refused("TEAM_NOT_FOUND");

  try {
    const reason = await deleteTeam(supabaseAdmin, { teamId: input.teamId, userId: user.id });
    if (reason) return refused(reason);
    log.info("team.deleted", { teamId: input.teamId, userId: user.id });
    revalidateEventPages();
    return { ok: true };
  } catch (error) {
    return failed("team.delete_failed", { teamId: input.teamId, userId: user.id }, error);
  }
}
