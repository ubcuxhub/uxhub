import { PageContainer } from "@/components/shared/PageContainer";
import {
  EventCreateModify,
} from "@/features/admin/components/EventCreateModify";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  searchMentors,
  searchSponsors,
} from "@/lib/supabase-helpers/event-people";

export default async function AdminCreateEventPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [mentorOptions, sponsorOptions] = await Promise.all([
    searchMentors(supabase, ""),
    searchSponsors(supabase, ""),
  ]);

  return (
    <PageContainer className="max-w-none min-[821px]:px-12 lg:px-12">
      <EventCreateModify
        mentorOptions={mentorOptions}
        sponsorOptions={sponsorOptions}
      />
    </PageContainer>
  );
}
