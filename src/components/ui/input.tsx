"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  "data-allow-number-step"?: boolean | "true" | "false";
};

const allowsNumberStep = (input: HTMLInputElement) =>
  input.dataset.allowNumberStep === "true" ||
  input.classList.contains("allow-number-step");

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onKeyDown, onWheel, ...props }, ref) => {
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

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-full border border-border bg-background px-5 py-1 text-body text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-table file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground sm:h-(--size-control)",
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
