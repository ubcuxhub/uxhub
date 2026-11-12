import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";

import { AuthPanel } from "./AuthPanel";

interface AuthMessageProps
  extends Omit<ComponentPropsWithoutRef<typeof AuthPanel>, "children"> {
  /** Follow-up actions under the message, e.g. resend or buttons. */
  children?: ReactNode;
  /** Quiet text link under the actions, e.g. "Back to sign in". */
  backLink?: { href: string; label: string };
}

/**
 * Shared shell for the terminal auth screens: the ones that report an outcome
 * rather than collect input (check email, verify email, expired link, error).
 * The message itself goes in `description`.
 */
export function AuthMessage({
  children,
  backLink,
  ...props
}: AuthMessageProps) {
  return (
    <AuthPanel {...props}>
      <div className="flex flex-col items-start gap-3">
        {children}

        {backLink ? (
          <Link
            href={backLink.href}
            className="text-body text-foreground underline underline-offset-4"
          >
            {backLink.label}
          </Link>
        ) : null}
      </div>
    </AuthPanel>
  );
}
