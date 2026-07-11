// Chrome-free layout for focused purchase/onboarding flows (membership list,
// join wizard, and checkout). No sidebar; each page controls its own width via
// PageContainer. Auth and UserProvider come from the parent (app)/layout.tsx.
export default function FocusedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-svh w-full overflow-y-auto">{children}</div>;
}
