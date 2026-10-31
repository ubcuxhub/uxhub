import { forwardRef, type ComponentProps } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerButtonProps
  extends Omit<ComponentProps<typeof Button>, "variant" | "children"> {
  /** The formatted date, or empty to show the placeholder. */
  label?: string;
  placeholder?: string;
}

/**
 * The trigger of an admin date-picker popover. Pass it to `PopoverTrigger asChild`.
 */
export const DatePickerButton = forwardRef<HTMLButtonElement, DatePickerButtonProps>(
  ({ label, placeholder = "Pick a date", className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="secondary"
      className={cn("w-full justify-start text-left", !label && "text-muted-foreground", className)}
      {...props}
    >
      <CalendarIcon data-icon="inline-start" aria-hidden />
      {label || placeholder}
    </Button>
  ),
);
DatePickerButton.displayName = "DatePickerButton";
