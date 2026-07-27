import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminCreateEventPage() {
  await requireAdmin();

  return (
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify
        title="Create a New Event"
        description="Complete the form below to add a new event to the gallery."
      />
    </PageContainer>
  );
}
