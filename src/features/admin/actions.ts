"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireManager } from "@/lib/auth/guards";
import { createUniqueSlug, slugify } from "@/lib/slug";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  adminDeleteEventImageByUrl,
  adminUpdateMembershipTermEndsAt,
  adminUpdateMembershipTypeById,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import { datetimeLocalToTimestamptz } from "@/lib/date";
import { assertPublishAt } from "@/features/admin/lib/event-publication";
import {
  validateMembershipTypeInput,
  type MembershipTypeInput,
} from "@/features/admin/lib/membership-type";
import {
  checkInTicket,
  deleteCheckIn,
  fetchCheckInAttendees,
  fetchCheckInSessionEventId,
  fetchCheckInSessions,
  fetchCheckInStatuses,
  fetchCheckInTicketById,
  fetchCheckInTicketByToken,
  type CheckInTicket,
} from "@/lib/supabase-helpers/check-ins";
import { isUuid } from "@/lib/uuid";
import type { CheckInRejection, CheckInResult } from "./types";
import {
  saveMentor,
  saveSponsor,
  type MentorInput,
  type SponsorInput,
} from "@/lib/supabase-helpers/event-people";
import { removeApplicationFiles } from "@/lib/supabase-helpers/application-files";
import { updateEventApplication } from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventById,
  fetchEventIdByImageUrl,
  fetchEventSlugsByPrefix,
} from "@/lib/supabase-helpers/events";
import type {
  ApplicationQuestionInput,
  CheckInSessionInput,
} from "@/features/admin/types";
import type {
  EventUpdate,
  MentorRow,
  SponsorRow,
  UserInfoUpdate,
} from "@/lib/supabase/models";
import type { RoleAccess, SubmittedApplicationRow } from "@/lib/supabase/models";
import { fetchActiveProfile, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { normalizeInterests, validateBirthDate } from "./lib/user-profile";
import {
  buildApplicationDecisionUpdate,
  type ApplicationDecision,
} from "./lib/application-review";

const MANAGER_USER_FIELDS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "newsletter",
  "student_number",
  "faculty",
  "major",
  "year",
  "membership_type_id",
  "order_date_deprecated",
]);

function assertManagerUserUpdate(
  field: string,
  value: string | number | boolean | null
): UserInfoUpdate {
  const databaseField =
    field === "order_date" ? "order_date_deprecated" : field;

  if (!MANAGER_USER_FIELDS.has(databaseField)) {
    throw new Error("This user field cannot be edited.");
  }

  if (databaseField === "first_name" || databaseField === "last_name") {
    const normalizedName = typeof value === "string" ? value.trim() : "";
    if (!normalizedName) {
      throw new Error(
        databaseField === "first_name"
          ? "First name is required."
          : "Last name is required."
      );
    }
    return { [databaseField]: normalizedName } as UserInfoUpdate;
  }

  if (
    databaseField === "year" &&
    value !== null &&
    !["1", "2", "3", "4", "5+"].includes(String(value))
  ) {
    throw new Error("Invalid university year.");
  }

  return { [databaseField]: value } as UserInfoUpdate;
}

export async function updateManagerUserAction(
  userId: string,
  field: string,
  value: string | number | boolean | null
) {
  await requireManager();

  if (!userId) {
    throw new Error("A user id is required.");
  }

  const payload = assertManagerUserUpdate(field, value);
  await adminUpdateUserInfoById(userId, payload);
  revalidatePath("/admin/users", "layout");
}

/** Save the form's profile fields together; roles retain their separate RPC guard. */
export async function saveManagerUserDetailsAction(userId: string, changes: Record<string, unknown>) {
  await requireManager();
  if (!userId) throw new Error("A user id is required.");
  const patch: UserInfoUpdate = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === "birth_date") patch.birth_date = validateBirthDate(value);
    else if (field === "interests") patch.interests = normalizeInterests(value);
    else if (field === "school_institution") {
      if (value !== null && typeof value !== "string") throw new Error("Enter a valid school or institution.");
      const user = await fetchActiveProfile(supabaseAdmin, userId);
      const school = typeof value === "string" ? value.trim() || null : null;
      if (school === user.school_institution) continue;
      // Validate against the resulting membership, including a tier changed in this save.
      const membershipId = Object.hasOwn(changes, "membership_type_id") ? changes.membership_type_id : user.membership_type_id;
      const membership = typeof membershipId === "string" && membershipId
        ? await fetchMembershipTypeById(supabaseAdmin, membershipId) : null;
      if (membership?.name !== "nonUbc") throw new Error("School can only be changed for Non-UBC members.");
      patch.school_institution = school;
    }
    else {
      if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw new Error("Invalid user field value.");
      if (field === "newsletter" && typeof value !== "boolean") throw new Error("Choose a newsletter preference.");
      Object.assign(patch, assertManagerUserUpdate(field, value as string | number | boolean | null));
    }
  }
  const user = await saveAdminProfile(supabaseAdmin, userId, patch);
  revalidatePath("/admin/users", "layout");
  return user;
}

export async function updateUserRoleAction(
  userId: string,
  role: RoleAccess
): Promise<RoleAccess> {
  await requireManager();

  if (!userId) {
    throw new Error("A user id is required.");
  }
  if (role !== "basic" && role !== "admin" && role !== "manager") {
    throw new Error("Invalid role.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_user_role", {
    p_target_user_id: userId,
    p_role: role,
  });

  if (error) throw error;
  if (!data) throw new Error("The role update returned no role.");

  revalidatePath("/admin/users", "layout");
  return data;
}

export interface SaveAdminEventInput {
  eventId?: string;
  /**
   * The cover image URL the form was loaded with, used as the precondition for
   * an update. Ignored when creating.
   */
  expectedImageUrl: string | null;
  event: EventUpdate;
  checkInSessions: CheckInSessionInput[];
  mentorIds: string[];
  sponsorIds: string[];
  applicationQuestions: ApplicationQuestionInput[];
}

/**
 * The saved event's id and the ids of its check-in sessions and application
 * questions, each in the order they were sent, or why the save was refused.
 */
export type SaveAdminEventResult =
  | { id: string; checkInSessionIds: string[]; questionIds: string[] }
  | { error: string };

// Not exported: a "use server" module may only export async functions, and the
// form surfaces this by displaying the thrown error's message.
// Raised by save_admin_event_atomically when the cover-image precondition fails.
const IMAGE_CONFLICT_SENTINEL = "EVENT_IMAGE_CONFLICT";

const SAVE_CONFLICT_ERROR =
  "This event's cover image was changed somewhere else since this page loaded. Reload the page and apply your changes again.";

// The hints save_admin_event_atomically gives a refusal over application
// questions (removing or retyping answered ones, or a stale question id) or
// check-in sessions (removing one with check-ins, or a stale session id). Its
// message is written for the admin, and is returned rather than thrown, since
// production builds withhold a thrown error's message from the client.
const REFUSAL_EVENTS = new Map([
  ["APPLICATION_QUESTIONS_CONFLICT", "admin.event_questions_save_refused"],
  ["CHECK_IN_SESSIONS_CONFLICT", "admin.event_check_in_sessions_save_refused"],
]);

/**
 * Removes a cover image that is no longer referenced by any event.
 *
 * Best-effort on purpose: the database is the source of truth, so a leaked
 * storage object is cheaper than failing a save or delete that already
 * succeeded. No-ops for values that are not storage URLs.
 */
async function discardEventImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return;

  try {
    await adminDeleteEventImageByUrl(imageUrl);
  } catch (error) {
    log.error("admin.event_image_delete_failed", errorFields(error));
  }
}

/**
 * Removes uploaded application files nothing answers with any more. Best
 * effort, like `discardEventImage`: the save has already committed.
 */
async function discardApplicationFiles(paths: string[]) {
  if (paths.length === 0) return;

  try {
    await removeApplicationFiles(supabaseAdmin, paths);
  } catch (error) {
    log.warn("admin.application_files_delete_failed", errorFields(error));
  }
}

/**
 * Removes a cover image that was uploaded for a save that then failed.
 *
 * Safe to expose to the client even though it takes a URL: it refuses to touch
 * anything an event still references, so a save that actually landed can never
 * lose its image, and `discardEventImage` ignores URLs outside our bucket.
 */
export async function discardUnusedEventImageAction(imageUrl: string) {
  await requireAdmin();

  if (!imageUrl) return;
  if (await fetchEventIdByImageUrl(supabaseAdmin, imageUrl)) return;

  await discardEventImage(imageUrl);
}

export async function saveAdminEventAction(
  input: SaveAdminEventInput
): Promise<SaveAdminEventResult> {
  await requireAdmin();

  assertPublishAt(input.event.status, input.event.publish_at);

  let slug: string | null = null;

  if (!input.eventId) {
    const normalizedBaseSlug = slugify(input.event.name ?? "");
    const baseSlug =
      normalizedBaseSlug === "item" ? "event" : normalizedBaseSlug;
    const existingSlugs = await fetchEventSlugsByPrefix(
      supabaseAdmin,
      baseSlug
    );
    slug = createUniqueSlug(
      input.event.name ?? "event",
      existingSlugs,
      "event"
    );
  }

  // The cover-image precondition is checked inside the same statement that
  // writes the row, so a stale tab cannot overwrite a replacement made
  // elsewhere between this form loading and saving.
  const { data, error } = await supabaseAdmin.rpc(
    "save_admin_event_atomically",
    {
      p_event_id: input.eventId ?? null,
      p_event: input.event,
      p_slug: slug,
      p_expected_image_url: input.expectedImageUrl,
      p_check_in_sessions: input.checkInSessions,
      p_application_questions: input.applicationQuestions,
      p_mentors: input.mentorIds,
      p_sponsors: input.sponsorIds,
    }
  );
  if (error) {
    if (error.message.includes(IMAGE_CONFLICT_SENTINEL)) {
      throw new Error(SAVE_CONFLICT_ERROR);
    }
    const refusal = REFUSAL_EVENTS.get(error.hint);
    if (refusal) {
      log.warn(refusal, { eventId: input.eventId ?? null });
      return { error: error.message };
    }
    throw error;
  }
  const saved = data as {
    id?: string;
    check_in_session_ids?: string[];
    question_ids?: string[];
    removed_files?: string[];
  } | null;
  if (!saved?.id) throw new Error("The event save returned no event id.");

  // The save landed, so the image it replaced is unreferenced.
  if (input.eventId && (input.event.image_url ?? null) !== input.expectedImageUrl) {
    await discardEventImage(input.expectedImageUrl);
  }

  // Files answering questions the save removed, from drafts only: a question
  // with submitted answers cannot be removed.
  await discardApplicationFiles(saved.removed_files ?? []);

  // The list, and the event's overview (page and drawer) and builder below it.
  revalidatePath("/admin/events", "layout");
  revalidatePath("/events", "layout");
  return {
    id: saved.id,
    checkInSessionIds: saved.check_in_session_ids ?? [],
    questionIds: saved.question_ids ?? [],
  };
}

export async function saveAdminMentorAction(
  input: MentorInput
): Promise<MentorRow> {
  await requireAdmin();
  if (!input.full_name.trim()) {
    throw new Error("Mentor name is required.");
  }
  const mentor = await saveMentor(supabaseAdmin, input);
  revalidatePath("/admin/events", "layout");
  return mentor;
}

export async function saveAdminSponsorAction(
  input: SponsorInput
): Promise<SponsorRow> {
  await requireAdmin();
  if (!input.name.trim()) {
    throw new Error("Sponsor name is required.");
  }
  const sponsor = await saveSponsor(supabaseAdmin, input);
  revalidatePath("/admin/events", "layout");
  return sponsor;
}

export async function deleteAdminEventAction(eventId: string) {
  await requireAdmin();

  const existing = await fetchEventById(supabaseAdmin, eventId);

  const { error } = await supabaseAdmin.rpc("delete_event_atomically", {
    target_event_id: eventId,
  });

  if (error) throw error;

  await discardEventImage(existing?.image_url);

  revalidatePath("/admin/events", "layout");
}

/**
 * Records a review decision. Accepting needs a future `offerExpiresAt`
 * (docs/event-states.md); the database refuses moves the review flow does not
 * allow, such as taking back an offer the applicant already registered on.
 */
export async function updateApplicationDecisionAction(
  applicationId: string,
  decision: ApplicationDecision,
  offerExpiresAt: string | null
): Promise<SubmittedApplicationRow> {
  await requireAdmin();

  const result = buildApplicationDecisionUpdate(decision, offerExpiresAt);
  if (!result.ok) throw new Error(result.error);

  // The database refuses to decide a draft, so the row that comes back has
  // been submitted.
  const updated = await updateEventApplication(
    supabaseAdmin,
    applicationId,
    result.update
  );
  if (updated.status === "draft") {
    throw new Error("A draft application cannot be decided.");
  }
  return { ...updated, status: updated.status };
}

/** Checks a ticket in to a session, or removes a mistaken check-in. */
export async function toggleCheckInAction(
  ticketId: string,
  sessionId: string,
  checked: boolean
): Promise<string | null> {
  await requireAdmin();

  if (!checked) {
    await deleteCheckIn(supabaseAdmin, ticketId, sessionId);
    return null;
  }

  const { checkedInAt } = await checkInTicket(supabaseAdmin, ticketId, sessionId);
  return checkedInAt;
}

// `event_tickets.qr_token` is 16 random bytes as hex.
const QR_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

type CheckInMethod = "scan" | "lookup";

/** Checks in the ticket whose QR code was scanned at the door. */
export async function checkInScannedTicketAction(
  sessionId: string,
  code: string
): Promise<CheckInResult> {
  await requireAdmin();

  const qrToken = typeof code === "string" ? code.trim() : "";
  if (!QR_TOKEN_PATTERN.test(qrToken)) {
    return rejectCheckIn("invalid_code", "scan", sessionId);
  }

  const [eventId, ticket] = await Promise.all([
    fetchSessionEventId(sessionId),
    fetchCheckInTicketByToken(supabaseAdmin, qrToken),
  ]);
  if (!ticket) return rejectCheckIn("invalid_code", "scan", sessionId);

  return recordCheckIn(ticket, eventId, sessionId, "scan");
}

/** Checks in a ticket an admin picked by name when its code won't scan. */
export async function checkInTicketAction(
  sessionId: string,
  ticketId: string
): Promise<CheckInResult> {
  await requireAdmin();

  const [eventId, ticket] = await Promise.all([
    fetchSessionEventId(sessionId),
    typeof ticketId === "string" && isUuid(ticketId)
      ? fetchCheckInTicketById(supabaseAdmin, ticketId)
      : null,
  ]);
  if (!ticket) return rejectCheckIn("not_found", "lookup", sessionId);

  return recordCheckIn(ticket, eventId, sessionId, "lookup");
}

async function fetchSessionEventId(sessionId: string): Promise<string> {
  const eventId =
    typeof sessionId === "string" && isUuid(sessionId)
      ? await fetchCheckInSessionEventId(supabaseAdmin, sessionId)
      : null;
  if (!eventId) throw new Error("Check-in session not found.");
  return eventId;
}

async function recordCheckIn(
  ticket: CheckInTicket,
  eventId: string,
  sessionId: string,
  method: CheckInMethod
): Promise<CheckInResult> {
  if (ticket.event_id !== eventId) {
    return rejectCheckIn("wrong_event", method, sessionId, ticket.id);
  }

  const { checkedInAt, alreadyCheckedIn } = await checkInTicket(
    supabaseAdmin,
    ticket.id,
    sessionId
  );
  log.info("check_in.recorded", {
    method,
    sessionId,
    ticketId: ticket.id,
    alreadyCheckedIn,
  });

  return {
    status: alreadyCheckedIn ? "already_checked_in" : "checked_in",
    name: ticket.user_name,
    checkedInAt,
  };
}

function rejectCheckIn(
  reason: CheckInRejection,
  method: CheckInMethod,
  sessionId: string,
  ticketId: string | null = null
): CheckInResult {
  log.warn("check_in.rejected", { reason, method, sessionId, ticketId });
  return { status: "rejected", reason };
}

export async function fetchAdminCheckInSnapshotAction(eventId: string) {
  await requireAdmin();

  const [sessions, attendees, statuses] = await Promise.all([
    fetchCheckInSessions(supabaseAdmin, eventId),
    fetchCheckInAttendees(supabaseAdmin, eventId),
    fetchCheckInStatuses(supabaseAdmin, eventId),
  ]);

  return {
    sessions,
    attendees,
    statuses: Array.from(statuses.entries()),
  };
}

/**
 * Sets or clears the club-wide membership term end date.
 *
 * `date` is a bare `YYYY-MM-DD` from a date input, or null to clear the
 * ceiling. It is stored as the last second of that day in Pacific time — the
 * date a manager picks means "through the end of that day" to a member in
 * Vancouver, and storing UTC midnight would cut them off the previous
 * afternoon.
 *
 * The whole app reads this, so the revalidation is layout-wide.
 */
export async function setMembershipTermEndsAtAction(date: string | null) {
  const manager = await requireManager();

  let value: string | null = null;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Enter a valid date.");
    }

    value = datetimeLocalToTimestamptz(`${date}T23:59:59`);
    if (!value) throw new Error("Enter a valid date.");
  }

  await adminUpdateMembershipTermEndsAt(value, manager.id);
  revalidatePath("/", "layout");

  return value;
}

/**
 * Edits one membership tier from Club Settings.
 *
 * The update is built here from three named columns rather than from the
 * caller's payload, in the spirit of `MANAGER_USER_FIELDS` above: `slug` is
 * absent because checkout URLs are `/portal/membership/<slug>/checkout` and a
 * rename breaks live links; `name` because it is already printed on sent
 * receipts; `eligible_user_types` because emptying it would silently make a
 * tier unpurchasable for everyone.
 */
export async function updateMembershipTypeAction(
  id: string,
  input: MembershipTypeInput
) {
  await requireManager();

  if (!id) throw new Error("Membership tier not found.");

  const description = input.description.trim();
  const problem = validateMembershipTypeInput({ ...input, description });
  if (problem) throw new Error(problem);

  const updated = await adminUpdateMembershipTypeById(id, {
    active: input.active,
    description,
    price: input.price,
  });

  // Tier copy and price render on the portal home card, the membership plans
  // dialog, and the checkout summary, which sit under different layouts.
  revalidatePath("/", "layout");

  const row = updated?.[0] as
    | { active: boolean; description: string; price: number }
    | undefined;

  if (!row) throw new Error("Membership tier not found.");

  return {
    active: row.active,
    description: row.description,
    price: Number(row.price),
  };
}
