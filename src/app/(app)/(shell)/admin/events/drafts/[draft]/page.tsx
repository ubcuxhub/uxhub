import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventByLegacyDraftId } from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";

export default async function DraftPage({ params }: { params: Promise<{ draft: string }> }) {
  await requireAdmin();
  const { draft: id } = await params;
  if (!isUuid(id)) notFound();
  const event = await fetchEventByLegacyDraftId(await createClient(), id);
  if (!event) notFound();
  redirect(`/admin/events/${event.id}/edit`);
}
