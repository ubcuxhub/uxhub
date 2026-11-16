"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStaffVolunteerSchedule } from "@/lib/supabase-helpers/event-content";
import { isUuid } from "@/lib/uuid";
import { safeStaffScheduleUrl } from "./lib/event-content";

export async function createVolunteerScheduleAction(input: {
  eventId: string; url: string; operationId: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!input || !isUuid(input.eventId) || !isUuid(input.operationId) || typeof input.url !== "string"
    || input.url.length > 5000 || !safeStaffScheduleUrl(input.url)) {
    return { ok: false, error: "Enter an absolute HTTPS URL without a username or password." };
  }
  try {
    const saved = await createStaffVolunteerSchedule(supabaseAdmin, input);
    revalidatePath("/admin/events", "layout");
    return { ok: true, url: saved.url };
  } catch (error) {
    const hint = error && typeof error === "object" && "hint" in error ? error.hint : null;
    if (hint === "STAFF_SCHEDULE_EXISTS") return { ok: false, error: "A volunteer schedule was already added. Reload the agenda to view it; use the event editor to change it." };
    log.warn("admin.volunteer_schedule_create_failed", { eventId: input.eventId });
    return { ok: false, error: "Couldn’t save the link. Your URL is still here. Try saving again." };
  }
}
