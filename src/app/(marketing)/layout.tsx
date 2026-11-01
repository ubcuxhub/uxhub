import { ForceLightTheme } from "@/components/shared/ForceLightTheme";
import { forceLightThemeScript } from "@/lib/theme";

// The marketing palette is light-only (see `.marketing-home`), so these routes
// ignore the user's dark preference and restore it when they leave.
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="marketing-home">
      <script dangerouslySetInnerHTML={{ __html: forceLightThemeScript }} />
      <ForceLightTheme />
      {children}
    </div>
  );
}
