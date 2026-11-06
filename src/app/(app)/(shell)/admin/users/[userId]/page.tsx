import { AdminUserRecordRoute } from "@/features/admin/components/AdminUserRecordRoute";

/** A user's record, in the drawer the users layout opens over the list. */
export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  return <AdminUserRecordRoute userId={(await params).userId} />;
}
