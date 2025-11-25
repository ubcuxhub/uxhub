"use client";

import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminSidebar } from "@/components/AdminSidebar";
import { EventCreateModify } from "@/components/EventCreateModify";

const AdminCreateEventPage = () => {
  const router = useRouter();

  return (
    <ProtectedRoute admin>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="flex w-full justify-center py-10">
            <EventCreateModify
              onSuccess={() => router.push("/admin/events")}
              title="Create a New Event"
              description="Complete the form below to add a new event to the gallery."
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminCreateEventPage;
