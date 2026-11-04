"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * One group per question, with the question as its legend (§3.12). Compose with
 * `FieldSet` + `FieldLegend` for a list, or wrap each option in `FieldLabel`
 * for radio cards: `field.tsx` highlights the card through
 * `has-data-[state=checked]`, so neither needs an edit there.
 *
 * `name`, `required` and `defaultValue` submit through Radix's hidden input.
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-4", className)}
      {...props}
    />
  );
}

/**
 * 20px circle with a 1.5px edge, matching Checkbox. Selected turns the edge
 * `primary` and shows a 10px dot. `aria-invalid` on the item turns the edge
 * `destructive`. On coarse pointers an invisible `::after` grows the hit area
 * to 44px.
 */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-muted-foreground bg-background transition-colors duration-150 focus-visible:focus-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-3",
        "data-[state=checked]:border-primary aria-invalid:border-destructive",
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2.5 rounded-full bg-primary data-[disabled]:bg-disabled-foreground"
      />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
