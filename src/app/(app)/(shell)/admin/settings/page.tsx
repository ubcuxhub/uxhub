import { PageContainer } from "@/components/shared/PageContainer";
import { MembershipTermSettings } from "@/features/admin/components/MembershipTermSettings";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";

// `requireAdmin()` is applied by the admin layout, so this page only reads.
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">Club Settings</h1>
        <p className="text-muted-foreground">
          Settings that apply to every UX Hub account.
        </p>
      </div>

      <MembershipTermSettings termEndsAt={termEndsAt} />
    </PageContainer>
  );
}
