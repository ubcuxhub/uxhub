"use client";

import { useRouter } from "next/navigation";

import { EventCreateModify } from "@/features/admin";

const AdminCreateEventPage = () => {
  const router = useRouter();

  return (
    <div className="flex w-full justify-center py-10">
      <EventCreateModify
        onSuccess={() => router.push("/admin/events")}
        title="Create a New Event"
        description="Complete the form below to add a new event to the gallery."
      />
    </div>
  );
};

export default AdminCreateEventPage;
