import { ForceLightTheme } from "@/components/shared/ForceLightTheme";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { forceLightThemeScript } from "@/lib/theme";

export default function AuthLayout({
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
