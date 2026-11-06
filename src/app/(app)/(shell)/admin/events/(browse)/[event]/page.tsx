import { AdminEventRecordRoute } from "@/features/admin/components/AdminEventRecordRoute";

/**
 * An event's overview, in the drawer the events layout opens over the list.
 * The builder is a page of its own at `../[event]/edit`.
 */
export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  return <AdminEventRecordRoute eventParam={(await params).event} />;
}
