import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin";
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
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify
        title="Create a New Event"
        description="Complete the form below to add a new event to the gallery."
        mentorOptions={mentorOptions}
        sponsorOptions={sponsorOptions}
      />
    </PageContainer>
  );
}
