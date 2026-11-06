import { AdminEventRecordRoute } from "@/features/admin/components/AdminEventRecordRoute";

export default async function InterceptedEventPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  return <AdminEventRecordRoute eventParam={(await params).event} mode="intercepted" />;
}
