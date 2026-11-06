import { RecordFrame } from "@/components/shared/RecordDrawer";
import { AdminUserRecordRoute } from "@/features/admin/components/AdminUserRecordRoute";

/** A user's record as its own page: a refresh, a shared link, or "Open as full page". */
export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <RecordFrame mode="canonical" listHref="/admin/users" listLabel="Back to Manage Users">
      <AdminUserRecordRoute userId={(await params).userId} mode="canonical" />
    </RecordFrame>
  );
}
