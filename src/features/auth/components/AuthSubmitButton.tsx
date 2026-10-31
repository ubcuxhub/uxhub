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
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
