"use client";

import { useRouter } from "next/navigation";

import { EventCreateModify } from "@/features/admin";
import { PageContainer } from "@/components/shared/PageContainer";

const AdminCreateEventPage = () => {
  const router = useRouter();

  return (
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify
        onSuccess={() => router.push("/admin/events")}
        title="Create a New Event"
        description="Complete the form below to add a new event to the gallery."
      />
    </PageContainer>
  );
};

export default AdminCreateEventPage;
