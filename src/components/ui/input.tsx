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
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-sm transition-colors file:border-0 file:bg-transparent file:text-table file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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
