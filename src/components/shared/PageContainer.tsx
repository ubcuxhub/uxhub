import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/BackButton";

interface PageContainerProps {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PageContainer({
  children,
  backHref,
  backLabel,
  className,
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8", className)}>
      {backHref ? (
        <BackButton link={backHref} label={backLabel} className="mb-6 w-fit" />
      ) : null}
      {children}
    </div>
  );
}
