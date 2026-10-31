import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
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

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, style, onCheckedChange, checked, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={cn(
          "relative size-5 shrink-0 cursor-pointer appearance-none rounded-sm border-[1.5px] border-muted-foreground bg-background transition-colors duration-150",
          "before:absolute before:inset-0 before:bg-primary-foreground before:opacity-0 before:transition-opacity before:duration-150 before:content-[''] before:[mask:var(--checkbox-check)_center/0.875rem_no-repeat]",
          "checked:border-primary checked:bg-primary checked:before:opacity-100",
          "indeterminate:border-primary indeterminate:bg-primary indeterminate:before:opacity-100 indeterminate:before:[mask:var(--checkbox-dash)_center/0.875rem_no-repeat]",
          "focus-visible:focus-ring aria-invalid:border-destructive",
          "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:before:bg-disabled-foreground",
          className,
        )}
        style={{ ...glyphVars, ...style }}
        ref={ref}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
