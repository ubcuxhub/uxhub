import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface BackPillProps {
  href: string;
  /** Name the parent page: "Back to Manage Events", never a bare "Back". */
  label: string;
  className?: string;
}

/**
 * The detail-page back link (design system §4.5): a 40px pill, a real link to
 * the parent page rather than `history.back()`. Callers place it first on the
 * page with 24px (`mb-6`) below it.
 */
export function BackPill({ href, label, className }: BackPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-5 text-body whitespace-nowrap text-fg transition-colors duration-150 hover:bg-surface-subtle focus-visible:focus-ring pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-[3px]",
        className,
      )}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

interface BackButtonProps {
  link: string;
  label?: string;
  className?: string;
}

/** `BackPill` with the `link` prop callers already use. */
export function BackButton({ link, label, className }: BackButtonProps) {
  if (!label && process.env.NODE_ENV !== "production") {
    console.warn(
      `BackButton to ${link} has no label. Name the parent page, e.g. "Back to Events".`,
    );
  }

  return <BackPill href={link} label={label ?? "Back"} className={className} />;
}
