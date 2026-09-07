import { PageContainer } from "@/components/shared/PageContainer";
import { MembershipTermSettings } from "@/features/admin/components/MembershipTermSettings";
import { MembershipTypeSettings } from "@/features/admin/components/MembershipTypeSettings";
import { requireManager } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { fetchMembershipTypes } from "@/lib/supabase-helpers/memberships";

export default async function AdminSettingsPage() {
  await requireManager();
  const supabase = await createClient();
  const [termEndsAt, membershipTypes] = await Promise.all([
    fetchMembershipTermEndsAt(supabase),
    // Retired tiers stay editable here, so managers can put one back on sale.
    fetchMembershipTypes(supabase, { includeInactive: true }),
  ]);

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">Club Settings</h1>
        <p className="text-muted-foreground">
          Settings that apply to every UX Hub account.
        </p>
      </div>

      <div className="space-y-10">
        <MembershipTermSettings termEndsAt={termEndsAt} />
        <MembershipTypeSettings membershipTypes={membershipTypes} />
      </div>
    </PageContainer>
  );
}
