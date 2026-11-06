import { RecordFrame } from "@/components/shared/RecordDrawer";
import { AdminUsersManager } from "@/features/admin/components/AdminUsersManager";
import { toUserRecord } from "@/features/admin/lib/user-record";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypeOptions } from "@/lib/supabase-helpers/memberships";
import { fetchAdminUserRecords } from "@/lib/supabase-helpers/users";

/**
 * Manage users. A layout, so the list stays mounted while a user's record
 * (`[userId]/page.tsx`) opens in a drawer over it and while records are
 * swapped; a refresh of a record's URL shows the list with its drawer too.
 */
export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const supabase = await createClient();
  const [rows, membershipTypes] = await Promise.all([
    fetchAdminUserRecords(supabase),
    fetchMembershipTypeOptions(supabase),
  ]);

  return (
    <>
      <AdminUsersManager users={rows.map(toUserRecord)} membershipTypes={membershipTypes} />
      <RecordFrame listHref="/admin/users">{children}</RecordFrame>
    </>
  );
}
