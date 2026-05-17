import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return <UserProvider initialUser={user}>{children}</UserProvider>;
}
