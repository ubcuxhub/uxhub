import Link from "next/link";

import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import type { PublicEventAction } from "@/features/events/lib/public-event-action";

/**
 * The public event page's registration button, as `publicEventActionFor`
 * decides it on the server: register, apply, go to the portal, or a disabled
 * button saying why not.
 */
export function EventRegistrationAction({ action }: { action: PublicEventAction }) {
  switch (action.kind) {
    case "disabled":
      return (
        <Button disabled className="self-start">
          {action.label}
        </Button>
      );
    case "link":
      return (
        <Button asChild className="self-start">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      );
    case "checkout":
      return (
        <Button asChild className="self-start">
          <FlowLink href={action.href}>{action.label}</FlowLink>
        </Button>
      );
  }
}
