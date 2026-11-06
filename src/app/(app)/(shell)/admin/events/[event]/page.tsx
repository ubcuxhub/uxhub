import { RecordFrame } from "@/components/shared/RecordDrawer";
import { AdminEventRecordRoute } from "@/features/admin/components/AdminEventRecordRoute";

/**
 * An event's overview as a page: a refresh, a shared link or "Open as full
 * page" of the URL the record drawer shows. The builder is at `./edit`.
 */
export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  return (
    <RecordFrame mode="canonical" listHref="/admin/events" listLabel="Back to Manage Events">
      <AdminEventRecordRoute eventParam={(await params).event} mode="canonical" />
    </RecordFrame>
  );
}
