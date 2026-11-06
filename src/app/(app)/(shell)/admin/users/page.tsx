import { AdminUsersManager } from "@/features/admin/components/AdminUsersManager";
import { toUserRecord } from "@/features/admin/lib/user-record";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypeOptions } from "@/lib/supabase-helpers/memberships";
import { fetchAdminUserRecords } from "@/lib/supabase-helpers/users";

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [rows, membershipTypes] = await Promise.all([
    fetchAdminUserRecords(supabase),
    fetchMembershipTypeOptions(supabase),
  ]);

  return <AdminUsersManager users={rows.map(toUserRecord)} membershipTypes={membershipTypes} />;
}
