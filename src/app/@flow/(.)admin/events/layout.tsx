import { RecordFrame } from "@/components/shared/RecordDrawer";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * The event record drawer, open over whatever page a soft navigation to
 * `/admin/events/<id>` came from. A layout, so moving between events keeps the
 * drawer open instead of replaying its slide-in.
 */
export default async function InterceptedEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // @flow is outside (app): no layout guard runs for it
  return (
    <RecordFrame mode="intercepted" listHref="/admin/events" listLabel="Back to Manage Events">
      {children}
    </RecordFrame>
  );
}
