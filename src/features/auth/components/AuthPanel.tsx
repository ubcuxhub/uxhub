import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";

export interface AuthPanelProps
  extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** The page's only `<h1>`. */
  title: ReactNode;
  /** Muted line under the title. Inline content only: it renders in a `<p>`. */
  description?: ReactNode;
  /**
   * Art above the heading, left-aligned (Figma: a 200px Hubbo). Decorative art
   * should carry `alt=""` or `aria-hidden`.
   */
  illustration?: ReactNode;
  /** Small muted line above the title, e.g. "Step 1 of 3". */
  stepLabel?: ReactNode;
  /**
   * Control placed before the step label, e.g. a Back `IconButton` on setup
   * steps (Figma puts Back beside the step label on mobile).
   */
  stepAction?: ReactNode;
  /**
   * "default" is the 600px sign-in card; "wide" is the 640px setup card,
   * with more room between sections.
   */
  size?: "default" | "wide";
  /**
   * Ref to the `<h1>`, which is focusable by script (`tabIndex={-1}`): a
   * multi-step flow moves focus here on each step change so the new heading
   * is announced.
   */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}

/**
 * The content column of `AuthShell`: a left-aligned header (optional art,
 * step label, title, description) over the page's form or message.
 *
 * From `lg` it is a bordered card centred beside the brand panel. Below `lg`
 * it has no edge and fills the white sheet, so its padding comes from the
 * shell.
 */
export function AuthPanel({
  title,
  description,
  illustration,
  stepLabel,
  stepAction,
  size = "default",
  headingRef,
  children,
  className,
  ...props
}: AuthPanelProps) {
  const hasStep = stepLabel != null || stepAction != null;

  return (
    <div
      data-slot="auth-panel"
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col text-foreground",
        "lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:px-10",
        size === "wide"
          ? "max-w-[640px] gap-8 lg:pt-12 lg:pb-10"
          : "max-w-[600px] gap-6 lg:py-14",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <div data-slot="auth-panel-illustration" className="flex">
          {illustration}
        </div>
      ) : null}

      <div data-slot="auth-panel-header" className="flex flex-col gap-2">
        {hasStep ? (
          <div className="flex min-h-5 items-center gap-2">
            {stepAction}
            {stepLabel != null ? (
              <p className="text-small font-medium text-muted-foreground">
                {stepLabel}
              </p>
            ) : null}
          </div>
        ) : null}

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-h1 text-balance text-foreground outline-none"
        >
          {title}
        </h1>

        {description != null ? (
          <p className="text-body text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div data-slot="auth-panel-content">{children}</div>
    </div>
  );
}
