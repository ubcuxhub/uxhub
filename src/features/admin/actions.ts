"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guards";
import { createUniqueSlug, slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  deleteApplicationQuestionsForEvent,
  insertApplicationQuestions,
} from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventById,
  fetchEventIdByImageUrl,
  fetchEventSlugsByPrefix,
  insertEvent,
  updateEvent,
  updateEventIfImageMatches,
} from "@/lib/supabase-helpers/events";
import {
  deleteCheckInSessionsForEvent,
  fetchAttendingRegistrations,
  fetchCheckInId,
  fetchCheckInSessions,
  fetchCheckInStatuses,
  insertCheckIn,
  insertCheckInSessions,
  updateCheckInTimestamp,
} from "@/lib/supabase-helpers/check-ins";
import { updateEventRegistration } from "@/lib/supabase-helpers/event-registrations";
import { fetchRegistrationsForEvent } from "@/lib/supabase-helpers/event-registrations";
import {
  adminDeleteEventImageByUrl,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import type {
  CheckInSessionInsert,
  EventApplicationQuestionInsert,
  EventInsert,
  EventUpdate,
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
  applicationQuestions: Omit<EventApplicationQuestionInsert, "event_id">[];
}

// Not exported: a "use server" module may only export async functions, and the
// form surfaces this by displaying the thrown error's message.
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

  let finalEventId: string;

  if (input.eventId) {
    const expectedImageUrl = input.expectedImageUrl;
    const nextImageUrl = input.event.image_url ?? null;

    if (nextImageUrl === expectedImageUrl) {
      // This save leaves the cover alone, so leave the column alone too. Writing
      // the loaded value back would revert a replacement made elsewhere to a URL
      // whose object that replacement already deleted.
      const payload: EventUpdate = { ...input.event };
      delete payload.image_url;

      const result = await updateEvent(supabaseAdmin, input.eventId, payload);
      finalEventId = result.id;
    } else {
      // Changing the cover deletes the old object, so the write is conditional
      // on the row still holding the image this form was loaded with.
      const result = await updateEventIfImageMatches(
        supabaseAdmin,
        input.eventId,
        input.event,
        expectedImageUrl
      );

      if (!result) throw new Error(SAVE_CONFLICT_ERROR);
      finalEventId = result.id;

      await discardEventImage(expectedImageUrl);
    }

    await deleteCheckInSessionsForEvent(supabaseAdmin, finalEventId);
    await deleteApplicationQuestionsForEvent(supabaseAdmin, finalEventId);
  } else {
    const normalizedBaseSlug = slugify(input.event.name ?? "");
    const baseSlug =
      normalizedBaseSlug === "item" ? "event" : normalizedBaseSlug;
    const existingSlugs = await fetchEventSlugsByPrefix(
      supabaseAdmin,
      baseSlug
    );
    const slug = createUniqueSlug(
      input.event.name ?? "event",
      existingSlugs,
      "event"
    );
    const result = await insertEvent(supabaseAdmin, {
      ...input.event,
      name: input.event.name ?? "",
      description: input.event.description ?? "",
      regular_price: input.event.regular_price ?? 0,
      member_price: input.event.member_price ?? 0,
      max_capacity: input.event.max_capacity ?? 0,
      slug,
    } as EventInsert);
    finalEventId = result.id;
  }

  if (input.checkInSessions.length > 0) {
    await insertCheckInSessions(
      supabaseAdmin,
      input.checkInSessions.map((session) => ({
        ...session,
        event_id: finalEventId,
      }))
    );
  }

  if (input.applicationQuestions.length > 0) {
    await insertApplicationQuestions(
      supabaseAdmin,
      input.applicationQuestions.map((question) => ({
        ...question,
        event_id: finalEventId,
      }))
    );
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${finalEventId}`);
  return { id: finalEventId };
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
