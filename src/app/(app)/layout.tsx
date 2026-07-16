import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";

// Shared authenticated boundary for both the sidebar shell ((shell)) and the
// focused, chrome-free flows ((focused)). Auth + current-user context live here
// so both child route groups inherit them; the sidebar itself is added only by
// (shell)/layout.tsx.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return <UserProvider initialUser={user}>{children}</UserProvider>;
}
