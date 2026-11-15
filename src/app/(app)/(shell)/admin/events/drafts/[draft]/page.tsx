import { notFound, redirect } from "next/navigation";
import { adminEventPath } from "@/features/admin/lib/admin-event-path";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventByLegacyDraftId } from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";

/**
 * A working draft's old URL. Drafts are events now, so this sends a recorded
 * draft identity straight to its event's builder at the event's slug (one hop,
 * rather than through the ID redirect).
 */
export default async function DraftPage({ params }: { params: Promise<{ draft: string }> }) {
  await requireAdmin();
  const { draft: id } = await params;
  if (!isUuid(id)) notFound();
  const event = await fetchEventByLegacyDraftId(await createClient(), id);
  if (!event) notFound();
  redirect(adminEventPath(event, "/edit"));
}
