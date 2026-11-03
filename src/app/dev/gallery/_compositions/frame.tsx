import type { ComponentProps } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The gallery's card: the real `Card`, with a hairline edge and a very soft
 * shadow so it lifts off the canvas. Compositions that are a surface of
 * their own (a ticket, the membership card) skip it.
 */
export function Panel({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "gap-5 border-border-subtle py-5 shadow-[0_1px_2px_rgb(17_17_17/0.04),0_6px_20px_-8px_rgb(17_17_17/0.08)]",
        className,
      )}
      {...props}
    />
  );
}

/** Extra-soft lift for compositions that bring their own surface. */
export const LIFT =
  "shadow-[0_1px_2px_rgb(17_17_17/0.04),0_6px_20px_-8px_rgb(17_17_17/0.08)]";
