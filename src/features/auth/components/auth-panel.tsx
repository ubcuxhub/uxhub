import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthPanelProps extends ComponentPropsWithoutRef<typeof Card> {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthPanel({
  title,
  description,
  children,
  className,
  ...props
}: AuthPanelProps) {
  return (
    <Card
      className={cn(
        "w-full max-w-[620px] gap-0 rounded-lg bg-card px-6 py-16 text-card-foreground shadow-none sm:px-10",
        className,
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-[540px]">
        <CardHeader className="mb-7 px-0 text-center">
          <CardTitle className="text-h1 text-foreground">{title}</CardTitle>

          {description ? (
            <p className="mt-3 text-body leading-6 text-foreground">
              {description}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="px-0">{children}</CardContent>
      </div>
    </Card>
  );
}
