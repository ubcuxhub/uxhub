import { AdminSidebar } from "@/components/AdminSidebar";
import EventCreateModify from "@/components/EventCreateModify";
import ProtectedRoute from "@/components/ProtectedRoute";
import React from "react";

interface EventViewProps {
  params: {
    event: string;
  };
}

const Page: React.FC<EventViewProps> = async ({ params }) => {
  const slug = await params;
  const eventId = slug.event;

  return (
    <ProtectedRoute admin>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="flex w-full justify-center py-10">
            <EventCreateModify eventId={eventId} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
