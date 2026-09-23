import type { ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthSubmitButtonProps = ComponentPropsWithoutRef<typeof Button>;

export function AuthSubmitButton({
  className,
  children,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <Button
      className={cn(
        // The default variant is already bg-primary (--action-primary); only the
        // hover and disabled tones differ from it, and both are designed tokens.
        "h-11 w-full shadow-none hover:bg-action-hover sm:h-10",
        "disabled:bg-action-disabled-bg disabled:text-action-disabled disabled:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
