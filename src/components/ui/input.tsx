"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  "data-allow-number-step"?: boolean | "true" | "false";
  /**
   * A 16px icon inside the left edge, for search and link fields. The icon is
   * decorative (`aria-hidden`); name the field with a label or `aria-label`.
   * Adds a wrapper element, so without it the DOM is the bare `<input>`.
   */
  leadingIcon?: LucideIcon;
  /** Classes for the wrapper that `leadingIcon` adds. `className` stays on the input. */
  wrapperClassName?: string;
};

const allowsNumberStep = (input: HTMLInputElement) =>
  input.dataset.allowNumberStep === "true" ||
  input.classList.contains("allow-number-step");

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, onKeyDown, onWheel, leadingIcon: LeadingIcon, wrapperClassName, ...props },
    ref,
  ) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);

      if (
        event.defaultPrevented ||
        type !== "number" ||
        allowsNumberStep(event.currentTarget)
      ) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
    };

    const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
      onWheel?.(event);

      if (
        event.defaultPrevented ||
        type !== "number" ||
        document.activeElement !== event.currentTarget ||
        allowsNumberStep(event.currentTarget)
      ) {
        return;
      }

      event.preventDefault();
    };

    const input = (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-full border border-border bg-background px-5 py-1 text-body text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-table file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground sm:h-(--size-control)",
          LeadingIcon && "peer pl-11",
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        {...props}
      />
    );

    if (!LeadingIcon) return input;

    return (
      <div
        data-slot="input-wrapper"
        className={cn("relative w-full", wrapperClassName)}
      >
        {input}
        <LeadingIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:text-disabled-foreground"
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
