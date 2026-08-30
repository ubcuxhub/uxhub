// Full-screen chrome for post-purchase confirmation pages. Auth and
// UserProvider come from the parent (app)/layout.tsx; the sidebar shell in
// (shell) is deliberately skipped so confirmations fill the viewport.
export default function ConfirmationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      {children}
    </div>
  );
}
