"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { joinIds, useFieldControl } from "@/components/ui/field";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
  /**
   * The mixed state of a select-all box. Visual and exposed to assistive tech
   * only: it does not change `checked`, and the next click sets `checked` as
   * usual.
   */
  indeterminate?: boolean;
}

/* Lucide "check" and "minus" as CSS masks, so the glyph takes its colour from
   the `before:` background and follows light and dark tokens. */
const glyph = (path: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`,
  )}")`;

const glyphVars = {
  "--checkbox-check": glyph("M20 6 9 17l-5-5"),
  "--checkbox-dash": glyph("M5 12h14"),
} as React.CSSProperties;

/**
 * Native checkbox. It is a `peer`, so a `Label` that follows it dims when the
 * box is disabled. Controlled use needs `onCheckedChange` (React warns without
 * it, as with any controlled input).
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      style,
      onCheckedChange,
      checked,
      indeterminate = false,
      "aria-describedby": describedBy,
      "aria-invalid": invalid,
      ...props
    },
    ref,
  ) => {
    const field = useFieldControl();
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // `indeterminate` is a DOM property with no attribute.
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate, checked]);

    return (
      <input
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          "peer relative size-5 shrink-0 cursor-pointer appearance-none rounded-sm border-[1.5px] border-muted-foreground bg-background transition-colors duration-150",
          "before:absolute before:inset-0 before:bg-primary-foreground before:opacity-0 before:transition-opacity before:duration-150 before:content-[''] before:[mask:var(--checkbox-check)_center/0.875rem_no-repeat]",
          "checked:border-primary checked:bg-primary checked:before:opacity-100",
          "indeterminate:border-primary indeterminate:bg-primary indeterminate:before:opacity-100 indeterminate:before:[mask:var(--checkbox-dash)_center/0.875rem_no-repeat]",
          "focus-visible:focus-ring aria-invalid:border-destructive",
          "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:before:bg-disabled-foreground",
          className,
        )}
        style={{ ...glyphVars, ...style }}
        ref={setRef}
        checked={checked}
        // Attached only when there is a handler, so React still warns about a
        // `checked` that nothing can change.
        onChange={
          onCheckedChange
            ? (event) => onCheckedChange(event.target.checked)
            : undefined
        }
        aria-describedby={joinIds(describedBy, field.describedBy)}
        aria-invalid={invalid ?? field.invalid}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
