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
  fetchEventSlugsByPrefix,
  insertEvent,
  updateEvent,
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
import { adminUpdateUserInfoById } from "@/lib/supabase-helpers/admin-server";
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
  event: EventUpdate;
  checkInSessions: Omit<CheckInSessionInsert, "event_id">[];
  applicationQuestions: Omit<EventApplicationQuestionInsert, "event_id">[];
}

export async function saveAdminEventAction(
  input: SaveAdminEventInput
): Promise<{ id: string }> {
  await requireAdmin();

  let finalEventId: string;

  if (input.eventId) {
    const result = await updateEvent(
      supabaseAdmin,
      input.eventId,
      input.event
    );
    finalEventId = result.id;

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

  const { error } = await supabaseAdmin.rpc("delete_event_atomically", {
    target_event_id: eventId,
  });

  if (error) throw error;
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
