import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Design-system buttons (§3.1). Variants and sizes keep their old names as
 * aliases so call sites need no change: `default` = `primary`, `outline` =
 * `secondary`, size `default` = `md`.
 *
 * `md` is 44px below `sm` and 40px above, matching Input and Select, so a
 * button beside a field lines up on phones.
 *
 * On coarse pointers an invisible `::after` grows the hit area to 44px (§2.4).
 * Its inset is measured from the padding box, so it is 1px more than the
 * overhang it adds past the 1px border. Every `after:` class is
 * `pointer-coarse:`-only: an in-flow `::after` on fine pointers would be a
 * flex item, and the gap before it would push the label off centre.
 *
 * Hover and pressed on Secondary and Ghost step through `surface-subtle` then
 * `border-subtle`: `surface-hover` is 1.02:1 against white, too faint to read
 * as feedback.
 *
 * Link uses `text-info-foreground`: `action-primary` is the same blue in dark mode and
 * only 3:1 on the dark page, where `status-info-text` steps up to blue-250.
 *
 * The disabled look swaps the fill and edge for the disabled tokens. A loading
 * button is `disabled` too but keeps its resting colours (`not-aria-busy:`),
 * since the spinner says why it can't be pressed.
 */
const primary =
  "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active " +
  "disabled:not-aria-busy:border-disabled-border disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled-foreground " +
  "aria-disabled:border-disabled-border aria-disabled:bg-disabled aria-disabled:text-disabled-foreground";

const secondary =
  "border-border bg-background text-foreground hover:bg-muted active:bg-border-subtle aria-pressed:bg-border-subtle " +
  "disabled:not-aria-busy:border-disabled-border disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled-foreground " +
  "aria-disabled:border-disabled-border aria-disabled:bg-disabled aria-disabled:text-disabled-foreground";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-transparent font-medium transition-colors duration-150 ease-out select-none focus-visible:focus-ring disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 pointer-coarse:after:absolute",
  {
    variants: {
      variant: {
        primary,
        /** @deprecated Use `primary`. */
        default: primary,
        secondary,
        /** @deprecated Use `secondary`. */
        outline: secondary,
        destructive:
          "border-transparent bg-destructive font-semibold text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active " +
          "disabled:not-aria-busy:border-disabled-border disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled-foreground " +
          "aria-disabled:border-disabled-border aria-disabled:bg-disabled aria-disabled:text-disabled-foreground",
        // Icon buttons and the few text uses with no DS equivalent. A disabled
        // ghost button only greys its label: a grey pill would read as a
        // secondary button.
        ghost:
          "bg-transparent text-foreground hover:bg-muted active:bg-border-subtle aria-pressed:bg-border-subtle disabled:not-aria-busy:text-disabled-foreground aria-disabled:text-disabled-foreground",
        link: "rounded-sm text-info-foreground underline-offset-4 hover:underline disabled:not-aria-busy:text-disabled-foreground aria-disabled:text-disabled-foreground",
      },
      size: {
        md: "h-11 gap-2 px-4 text-button sm:h-10 pointer-coarse:after:inset-0 pointer-coarse:sm:after:-inset-y-[3px] [&_svg]:size-4",
        /** @deprecated Use `md`. */
        default:
          "h-11 gap-2 px-4 text-button sm:h-10 pointer-coarse:after:inset-0 pointer-coarse:sm:after:-inset-y-[3px] [&_svg]:size-4",
        sm: "h-8 gap-1.5 px-3 text-button-small pointer-coarse:after:-inset-[7px] [&_svg]:size-3.5",
        icon: "size-8 p-0 pointer-coarse:after:-inset-[7px] [&_svg]:size-4",
        "icon-sm":
          "size-7 p-0 pointer-coarse:after:-inset-[9px] [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      // The IconButton edge. Size alone never adds a border: calendar days are
      // ghost icon buttons, and the secondary text button uses `border-border`.
      {
        variant: ["secondary", "outline"],
        size: ["icon", "icon-sm"],
        class: "border-border-subtle",
      },
      // Links sit in running text: no height or padding.
      {
        variant: "link",
        size: ["md", "default", "sm"],
        class: "h-auto p-0",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Shows a spinner in place of the label, keeping the button's width, and
   * disables it. The label stays in the accessibility tree. Ignored with
   * `asChild`.
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const busy = loading && !asChild;
    // An anchor ignores `disabled`, so a disabled link button is made inert by
    // hand: out of the tab order, announced as disabled, and its click (from a
    // mouse, Enter or a screen reader) swallowed before any handler sees it.
    const inertLink = asChild && disabled;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={busy || disabled}
        aria-busy={busy || undefined}
        {...props}
        {...(inertLink
          ? {
              "aria-disabled": true,
              tabIndex: -1,
              onClickCapture: (event: React.MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
              },
            }
          : null)}
      >
        {busy ? (
          <>
            <span className="inline-flex items-center justify-center gap-[inherit] opacity-0">
              {children}
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner size="sm" className="size-4 stroke-2! text-current" />
            </span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
