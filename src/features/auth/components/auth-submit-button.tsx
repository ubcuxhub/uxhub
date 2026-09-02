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
      variant="ghost"
      className={cn(
        "h-10 w-full rounded-md bg-action text-button font-medium text-primary-foreground shadow-none hover:bg-action-hover hover:text-primary-foreground disabled:!opacity-100 disabled:bg-[var(--action-disabled-bg)] disabled:text-[var(--action-disabled-text)]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}