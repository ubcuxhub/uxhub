import { ForceLightTheme } from "@/components/shared/ForceLightTheme";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { forceLightThemeScript } from "@/lib/theme";

// Member setup (`/portal/setup`) on the auth shell, without the portal
// sidebar. Auth and UserProvider come from the parent (app)/layout.tsx. Like
// the auth pages, setup is drawn for the light theme only.
//
// Not intercepted under @flow: setup is a full page, reached by a redirect
// from the portal home, so it has no dialog twin.
export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: forceLightThemeScript }} />
      <ForceLightTheme />
      <AuthShell>{children}</AuthShell>
    </>
  );
}
