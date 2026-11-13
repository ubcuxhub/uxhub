import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RegistrationTicketProps {
  title: ReactNode;
  description: ReactNode;
  ticket: ReactNode;
  actions: ReactNode;
  className?: string;
}

/** Figma 4619:149. Container width, rather than viewport width, selects the layout. */
export function RegistrationTicket({ title, description, ticket, actions, className }: RegistrationTicketProps) {
  return <Card className={cn("@container/registration gap-0 py-0", className)}>
    <CardHeader className="gap-0 border-b px-5 pt-5 [.border-b]:pb-4">
      <h2 className="text-subheading">Registration</h2>
      <CardDescription className="pt-0.5">1 ticket</CardDescription>
    </CardHeader>
    <CardContent className="grid grid-cols-1 items-center gap-y-4 p-5 @min-[56rem]/registration:grid-cols-[minmax(0,480px)_444px] @min-[56rem]/registration:gap-x-10">
      <div className="min-w-0 space-y-1 @min-[56rem]/registration:col-start-1 @min-[56rem]/registration:row-start-1 @min-[56rem]/registration:self-end">
        <p className="text-body break-words">{title}</p>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      <div className="w-full min-w-0 max-w-[444px] @min-[56rem]/registration:col-start-2 @min-[56rem]/registration:row-span-2 @min-[56rem]/registration:row-start-1">{ticket}</div>
      <div className="flex w-full max-w-[444px] flex-col gap-3 [&>*]:h-auto [&>*]:min-h-11 [&>*]:w-full [&>*]:max-w-full [&>*]:whitespace-normal [&>*]:py-2 sm:[&>*]:min-h-10 @min-[56rem]/registration:col-start-1 @min-[56rem]/registration:row-start-2 @min-[56rem]/registration:max-w-none @min-[56rem]/registration:flex-row @min-[56rem]/registration:flex-wrap @min-[56rem]/registration:self-start @min-[56rem]/registration:[&>*]:w-auto">
        {actions}
      </div>
    </CardContent>
  </Card>;
}
