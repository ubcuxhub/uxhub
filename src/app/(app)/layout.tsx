import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { headers } from "next/headers";

// Shared authenticated boundary for portal and admin routes. The proxy records
// the requested path so login can return users to direct deep links.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const user = await requireAuth(
    requestHeaders.get("x-uxhub-path") ?? undefined,
  );

  // Seeded here so authenticated pages never flash "become a member" at someone
  // whose membership the term end has already closed. Marketing pages let the
  // provider fetch it client-side instead, which keeps the root layout
  // synchronous and off the database.
  const supabase = await createClient();
  const membershipTermEndsAt = await fetchMembershipTermEndsAt(supabase);

  return (
    <UserProvider initialUser={user} initialTermEndsAt={membershipTermEndsAt}>
      {children}
    </UserProvider>
  );
}
