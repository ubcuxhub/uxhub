import { AdminUsersManager } from "@/features/admin/components/AdminUsersManager";
import type { UserRecord } from "@/features/admin";
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

  const users = rows.map((row) => {
    const membership = row.membership_types;
    const membershipTypeName = Array.isArray(membership)
      ? membership[0]?.name ?? null
      : membership?.name ?? null;

    const { membership_types: _membershipTypes, ...user } = row;
    void _membershipTypes;

    return {
      ...user,
      membership_type_name: membershipTypeName,
      order_date: user.order_date_deprecated,
    } as UserRecord;
  });

  return (
    <AdminUsersManager
      initialUsers={users}
      membershipTypes={membershipTypes}
    />
  );
}
