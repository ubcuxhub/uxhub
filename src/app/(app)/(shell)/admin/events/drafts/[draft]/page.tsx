import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin/components/EventCreateModify";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventDraft } from "@/lib/supabase-helpers/event-drafts";
import { searchMentors, searchSponsors } from "@/lib/supabase-helpers/event-people";
export default async function DraftPage({ params }: { params: Promise<{ draft: string }> }) {
  await requireAdmin();
  const { draft: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [draft, mentorOptions, sponsorOptions] = await Promise.all([fetchEventDraft(supabase, id), searchMentors(supabase, ""), searchSponsors(supabase, "")]);
  if (!draft || draft.event_id) notFound();
  return <PageContainer className="max-w-none min-[821px]:px-12 lg:px-12"><EventCreateModify initialDraft={draft} mentorOptions={mentorOptions} sponsorOptions={sponsorOptions} /></PageContainer>;
}
