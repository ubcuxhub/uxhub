import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";

export default async function LegacyMembershipPurchasePage({
  params,
}: {
  params: Promise<{ membership: string }>;
}) {
  const { membership } = await params;
  const supabase = await createClient();
  const membershipType = await fetchMembershipTypeById(supabase, membership);

  if (!membershipType) notFound();
  redirect(`/portal/membership/${membershipType.slug}/checkout`);
}
