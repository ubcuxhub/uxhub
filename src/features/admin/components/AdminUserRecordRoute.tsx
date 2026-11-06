import { Suspense } from "react";
import { notFound } from "next/navigation";

import { RecordNotFound } from "@/components/shared/RecordDrawer";
import { Spinner } from "@/components/ui/spinner";
import { requireAdmin } from "@/lib/auth/guards";
import { hasManagerAccess } from "@/lib/auth/roles";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypeOptions } from "@/lib/supabase-helpers/memberships";
import { fetchPurchasesForUser } from "@/lib/supabase-helpers/purchases";
import { fetchAdminUserRecordById } from "@/lib/supabase-helpers/users";
import { formatUserName } from "@/lib/user-name";

import { RECENT_PURCHASE_LIMIT, toUserPurchaseSummary } from "../lib/user-purchases";
import { toUserRecord } from "../lib/user-record";
import { AdminUserRecord } from "./AdminUserRecord";
import { UserTransactionList } from "./UserTransactionList";

/**
 * One user's record, for both `/admin/users/[userId]` routes: the drawer
 * opened from the list (`intercepted`) and the full page (`canonical`).
 *
 * Guards before it fetches: the intercepted route renders in `@flow`, outside
 * the admin layout and its guard.
 */
export async function AdminUserRecordRoute({
  userId,
  mode,
}: {
  userId: string;
  mode: "intercepted" | "canonical";
}) {
  const currentUser = await requireAdmin();
  const supabase = await createClient();
  const [result, membershipTypes] = await Promise.all([
    fetchAdminUserRecordById(supabase, userId),
    fetchMembershipTypeOptions(supabase),
  ]);

  if (!result) {
    if (mode === "canonical") notFound();
    return <RecordNotFound noun="user" />;
  }

  const record = toUserRecord(result.row);
  return (
    <AdminUserRecord
      // A different user is a fresh record: no draft carries over.
      key={record.id}
      record={record}
      verifierName={result.verifier ? formatUserName(result.verifier) : null}
      membershipTypes={membershipTypes}
      canManage={hasManagerAccess(currentUser.role_access)}
      currentUserId={currentUser.id}
      transactions={
        <Suspense
          fallback={
            <div className="flex justify-center py-6">
              <Spinner label="Loading recent transactions" />
            </div>
          }
        >
          <RecentTransactions userId={record.id} />
        </Suspense>
      }
    />
  );
}

/** Streams in after the record, so a slow purchase query doesn't hold the drawer. */
async function RecentTransactions({ userId }: { userId: string }) {
  let purchases;
  try {
    const supabase = await createClient();
    purchases = await fetchPurchasesForUser(supabase, userId, RECENT_PURCHASE_LIMIT);
  } catch (error) {
    log.error("admin.user_purchases_load_failed", { userId, ...errorFields(error) });
    return (
      <p role="alert" className="text-body text-destructive">
        Unable to load recent purchases. Reload to try again.
      </p>
    );
  }
  return <UserTransactionList purchases={purchases.map(toUserPurchaseSummary)} />;
}
