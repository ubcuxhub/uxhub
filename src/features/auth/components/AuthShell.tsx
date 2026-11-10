import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { BrandMotion } from "./BrandMotion";
import "./auth-shell.css";

function BrandLogo({ priority = false }: { priority?: boolean }) {
  return (
    <Link
      href="/"
      className="relative z-10 inline-flex rounded-sm focus-visible:focus-ring"
    >
      <Image
        src="/auth/logo-right-text-white.svg"
        alt="UBC UX Hub"
        width={95}
        height={40}
        className="h-10 w-auto"
        priority={priority}
      />
    </Link>
  );
}

/**
 * The frame every pre-portal screen sits in: sign-in, sign-up, password
 * reset, email verification, and the member setup steps. Put an `AuthPanel`
 * inside it.
 *
 * - `lg` and up: a brand panel (gradient, texture, logo and the shape pile,
 *   with its motion) beside a centred content column.
 * - Below `lg`: a 176px gradient header with the logo, and a white sheet with
 *   24px top corners overlapping it by 32px; content fills the width with
 *   20px margins.
 *
 * A server component; only the motion inside the brand panel is client code.
 */
export function AuthShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="auth-shell"
      className={cn(
        "min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[clamp(320px,33.4vw,480px)_minmax(0,1fr)]",
        className,
      )}
    >
      <header className="auth-brand-surface sticky top-0 hidden h-svh self-start overflow-hidden bg-background p-16 lg:block"
      >
        <BrandLogo priority />
        <BrandMotion />
      </header>

      <header className="auth-brand-surface relative h-44 bg-background px-5 pt-14 lg:hidden">
        <BrandLogo priority />
      </header>

      <main
        className="relative -mt-8 flex flex-col rounded-t-3xl bg-background px-5 pt-8 pb-10 sm:px-10 lg:mt-0 lg:min-h-svh lg:items-center lg:justify-center lg:rounded-none lg:p-10"
      >
        {children}
      </main>
    </div>
  );
}
