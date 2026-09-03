import Image from "next/image";
import Link from "next/link";

import { AuthLightMode } from "@/features/auth/components/auth-light-mode";

const authLightModeScript = `
(function(){
  try {
    var root = document.documentElement;
    root.dataset.authPreviousTheme = root.classList.contains("dark") ? "dark" : "light";
    root.classList.remove("dark");
  } catch (e) {}
})();
`;

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="bg-background text-foreground">
      <script dangerouslySetInnerHTML={{ __html: authLightModeScript }} />
      <AuthLightMode />

      <div className="grid min-h-svh lg:grid-cols-[minmax(320px,467px)_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden bg-ux-hub px-16 py-[72px] lg:block">
          <Link href="/" className="relative z-10 inline-flex items-center gap-3">
            <Image
              src="/auth/logo-right-text-white.svg"
              alt="UBC UX Hub Logo"
              width={100}
              height={42}
              className="h-auto w-[140px]"
              priority
            />
          </Link>
        </aside>

        {/* Below lg the brand aside is hidden, so the gradient moves behind the
            card rather than leaving it white-on-white. */}
        <section className="flex items-center justify-center bg-ux-hub px-6 py-10 sm:px-10 lg:bg-none lg:px-20">
          {children}
        </section>
      </div>
    </main>
  );
}
