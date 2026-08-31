"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guards";
import { createUniqueSlug, slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  adminDeleteEventImageByUrl,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import {
  fetchAttendingRegistrations,
  fetchCheckInId,
  fetchCheckInSessions,
  fetchCheckInStatuses,
  insertCheckIn,
  updateCheckInTimestamp,
} from "@/lib/supabase-helpers/check-ins";
import {
  saveMentor,
  saveSponsor,
  type MentorInput,
  type SponsorInput,
} from "@/lib/supabase-helpers/event-people";
import {
  fetchRegistrationsForEvent,
  updateEventRegistration,
} from "@/lib/supabase-helpers/event-registrations";
import {
  fetchEventById,
  fetchEventIdByImageUrl,
  fetchEventSlugsByPrefix,
} from "@/lib/supabase-helpers/events";
import type {
  CheckInSessionInsert,
  EventApplicationQuestionInsert,
  EventUpdate,
  MentorRow,
  SponsorRow,
  UserInfoUpdate,
} from "@/types/models";
import type { ApplicationStatus } from "@/types/models";

const ADMIN_USER_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "newsletter",
  "student_number",
  "faculty",
  "major",
  "year",
  "role_access",
  "membership_type_id",
  "order_date_deprecated",
]);

function assertAdminUserUpdate(
  field: string,
  value: string | number | boolean | null
): UserInfoUpdate {
  const databaseField =
    field === "order_date" ? "order_date_deprecated" : field;

  if (!ADMIN_USER_FIELDS.has(databaseField)) {
    throw new Error("This user field cannot be edited.");
  }

  if (
    databaseField === "role_access" &&
    value !== "basic" &&
    value !== "admin"
  ) {
    throw new Error("Invalid role.");
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

export async function updateAdminUserAction(
  userId: string,
  field: string,
  value: string | number | boolean | null
) {
  await requireAdmin();

  if (!userId) {
    throw new Error("A user id is required.");
  }

  const payload = assertAdminUserUpdate(field, value);
  await adminUpdateUserInfoById(userId, payload);
  revalidatePath("/admin/users");
}

export interface SaveAdminEventInput {
  eventId?: string;
  /**
   * The cover image URL the form was loaded with, used as the precondition for
   * an update. Ignored when creating.
   */
  expectedImageUrl: string | null;
  event: EventUpdate;
  checkInSessions: Omit<CheckInSessionInsert, "event_id">[];
  mentorIds: string[];
  sponsorIds: string[];
  applicationQuestions: Omit<EventApplicationQuestionInsert, "event_id">[];
}

// Not exported: a "use server" module may only export async functions, and the
// form surfaces this by displaying the thrown error's message.
// Raised by save_admin_event_atomically when the cover-image precondition fails.
const IMAGE_CONFLICT_SENTINEL = "EVENT_IMAGE_CONFLICT";

const SAVE_CONFLICT_ERROR =
  "This event's cover image was changed somewhere else since this page loaded. Reload the page and apply your changes again.";

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
    console.error("Failed to delete event image:", error);
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
): Promise<{ id: string }> {
  await requireAdmin();

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
    throw error;
  }
  if (!data?.id) throw new Error("The event save returned no event id.");

  // The save landed, so the image it replaced is unreferenced.
  if (input.eventId && (input.event.image_url ?? null) !== input.expectedImageUrl) {
    await discardEventImage(input.expectedImageUrl);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${data.id}`);
  return { id: data.id };
}

export async function saveAdminMentorAction(
  input: MentorInput
): Promise<MentorRow> {
  await requireAdmin();
  if (!input.full_name.trim()) {
    throw new Error("Mentor name is required.");
  }
  const mentor = await saveMentor(supabaseAdmin, input);
  revalidatePath("/admin/events");
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
  revalidatePath("/admin/events");
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

  revalidatePath("/admin/events");
}

export async function updateApplicationStatusAction(
  registrationId: string,
  status: ApplicationStatus
) {
  const admin = await requireAdmin();

  if (!["pending", "accepted", "declined"].includes(status)) {
    throw new Error("Invalid application status.");
  }

  await updateEventRegistration(supabaseAdmin, registrationId, {
    status,
    reviewer_id: admin.id,
  });
}

export async function toggleCheckInAction(
  registrationId: string,
  sessionId: string,
  checked: boolean
): Promise<string | null> {
  await requireAdmin();

  const existingCheckInId = await fetchCheckInId(
    supabaseAdmin,
    registrationId,
    sessionId
  );
  const checkedInAt = checked ? new Date().toISOString() : null;

  if (existingCheckInId) {
    await updateCheckInTimestamp(
      supabaseAdmin,
      existingCheckInId,
      checkedInAt
    );
  } else if (checked) {
    await insertCheckIn(supabaseAdmin, {
      event_registration_id: registrationId,
      check_in_session_id: sessionId,
      checked_in_at: checkedInAt,
    });
  }

  return checkedInAt;
}

export async function fetchAdminCheckInSnapshotAction(eventId: string) {
  await requireAdmin();

  const [sessions, registrations, statuses, allRegistrations] =
    await Promise.all([
      fetchCheckInSessions(supabaseAdmin, eventId),
      fetchAttendingRegistrations(supabaseAdmin, eventId),
      fetchCheckInStatuses(supabaseAdmin, eventId),
      fetchRegistrationsForEvent(supabaseAdmin, eventId),
    ]);

  return {
    sessions,
    registrations,
    statuses: Array.from(statuses.entries()),
    allRegistrations,
  };
}
