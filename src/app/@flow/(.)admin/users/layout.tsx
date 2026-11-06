import { RecordFrame } from "@/components/shared/RecordDrawer";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * A user opened from inside the app: a drawer beside Manage users. A layout,
 * so moving to another user swaps the content without replaying the drawer's
 * slide-in.
 */
export default async function InterceptedUsersLayout({ children }: { children: React.ReactNode }) {
  // @flow renders beside (app), so the admin layout's guard never runs here.
  await requireAdmin();
  return (
    <RecordFrame mode="intercepted" listHref="/admin/users" listLabel="Back to Manage Users">
      {children}
    </RecordFrame>
  );
}
