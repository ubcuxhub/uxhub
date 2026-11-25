import type { DbClient } from "./types";
import { TABLES } from "./tables";
import { fetchMembershipTermEndsAt } from "./app-settings";
import { getEffectiveMembershipExpiry } from "@/features/memberships/lib/expiry";

/** Explicit public export projection. IDs are used only as pagination cursors. */
export async function fetchUserExport(db: DbClient) {
  const access = await db.rpc("is_admin");
  if (access.error) throw access.error;
  if (!access.data) throw Object.assign(new Error("Staff access required"), { code: "42501" });
  const termEndsAt = await fetchMembershipTermEndsAt(db);
  const rows: UserExportRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = db.from(TABLES.userInfo)
      .select("id, first_name, last_name, email, role_access, membership_type_id, membership_expires_at, faculty, major, school_institution, year, created_at, membership_types!membership_type_id(name)")
      .is("deleted_at", null).order("id").limit(500);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    // Continue until empty, even if the server caps responses below our limit.
    if (!data?.length) return rows;
    for (const row of data) rows.push({
      name: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      role: row.role_access,
      membershipType: row.membership_types?.name ?? null,
      membershipExpiry: getEffectiveMembershipExpiry(row, termEndsAt),
      faculty: row.faculty,
      major: row.major,
      school: row.school_institution,
      studyYear: row.year,
      createdAt: row.created_at,
    });
    cursor = data[data.length - 1].id;
  }
}

export interface UserExportRecord {
  name: string;
  email: string;
  role: string;
  membershipType: string | null;
  membershipExpiry: string | null;
  faculty: string | null;
  major: string | null;
  school: string | null;
  studyYear: string | null;
  createdAt: string | null;
}
