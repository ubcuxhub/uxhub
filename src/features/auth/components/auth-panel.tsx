import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthPanelProps extends ComponentPropsWithoutRef<typeof Card> {
  title: string;
  description?: string;
  children: ReactNode;
  density?: "default" | "compact";
}

export function AuthPanel({
  title,
  description,
  children,
  className,
  density = "default",
  ...props
}: AuthPanelProps) {
  return (
    <Card
      className={cn(
        "w-full max-w-[620px] gap-0 rounded-lg border-border bg-card px-10 text-card-foreground shadow-none",
        density === "compact" ? "py-10" : "py-[100px]",
        className,
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-[540px]">
        <CardHeader className="mb-7 px-0 text-center">
          <CardTitle className="text-h1 text-foreground">
            {title}
          </CardTitle>

          {description ? (
            <p className="mt-3 text-body font-normal leading-6 text-foreground">
              {description}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="px-0">{children}</CardContent>
      </div>
    </Card>
  );
}