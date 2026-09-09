import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";
import { getMembershipTermEndsAt } from "@/lib/app-settings";
import { headers } from "next/headers";

// Shared authenticated boundary for portal and admin routes. The proxy records
// the requested path so login can return users to direct deep links.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();

  // The term end is seeded here so authenticated pages never flash "become a
  // member" at someone whose membership the term end has already closed.
  // Marketing pages let the provider fetch it client-side instead, which keeps
  // the root layout synchronous and off the database.
  //
  // The two reads are independent, so they overlap. If requireAuth redirects,
  // the settings read resolves into the void -- harmless, it is a read.
  const [user, membershipTermEndsAt] = await Promise.all([
    requireAuth(requestHeaders.get("x-uxhub-path") ?? undefined),
    getMembershipTermEndsAt(),
  ]);

  return (
    <UserProvider initialUser={user} initialTermEndsAt={membershipTermEndsAt}>
      {children}
    </UserProvider>
  );
}
