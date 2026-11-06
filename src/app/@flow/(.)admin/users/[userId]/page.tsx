import { AdminUserRecordRoute } from "@/features/admin/components/AdminUserRecordRoute";

export default async function InterceptedUserPage({ params }: { params: Promise<{ userId: string }> }) {
  return <AdminUserRecordRoute userId={(await params).userId} mode="intercepted" />;
}
