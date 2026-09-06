import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Inline notice for information a reader needs before they act — most notably
 * the membership term warning shown ahead of checkout.
 *
 * Colors come from the status tokens in `globals.css` (`--color-warning` and
 * friends) rather than raw Tailwind palette classes, so the light and dark
 * themes stay in step.
 */
const alertVariants = cva(
  "flex items-start gap-3 rounded-lg border border-transparent p-4 text-small",
  {
    variants: {
      variant: {
        warning: "bg-warning-bg text-warning",
        info: "bg-info-bg text-info",
        destructive: "bg-error-bg text-error",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Rendered before the content, e.g. a lucide icon. */
  icon?: React.ReactNode;
}

function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  return (
    <div
      role="note"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 opacity-90", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
