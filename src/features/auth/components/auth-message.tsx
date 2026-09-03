import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";

import { AuthPanel } from "./auth-panel";

interface AuthMessageProps
  extends Omit<ComponentPropsWithoutRef<typeof AuthPanel>, "title" | "children"> {
  title: string;
  children: ReactNode;
  /** Optional follow-up action, e.g. resending the email this screen announces. */
  action?: ReactNode;
  backLink?: { href: string; label: string };
}

/**
 * Shared shell for the terminal auth screens — the ones that report an outcome
 * rather than collect input (check email, sign-up success, error).
 */
export function AuthMessage({
  title,
  children,
  action,
  backLink,
  ...props
}: AuthMessageProps) {
  return (
    <AuthPanel title={title} {...props}>
      <div className="mx-auto flex max-w-[460px] flex-col items-center text-center">
        <div className="text-body leading-6 text-foreground">{children}</div>

        {action ? <div className="mt-7">{action}</div> : null}

        {backLink ? (
          <p className="mt-7 text-body text-muted-foreground">
            <Link
              href={backLink.href}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {backLink.label}
            </Link>
          </p>
        ) : null}
      </div>
    </AuthPanel>
  );
}
