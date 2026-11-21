import type { ComponentProps } from "react";

import { FlowLink } from "@/components/shared/FlowLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";
import {
  STAFF_TEST_REGISTRATION_LABEL,
  STAFF_TEST_REGISTRATION_WARNING,
  allowsStaffTestRegistration,
} from "@/features/events/lib/event-visibility";
import type { EventRow } from "@/lib/supabase/models";

type PanelProps = ComponentProps<typeof RegistrationPanel>;

/**
 * The Register area of a draft's portal page, which only admins and managers
 * can open (RLS). A free draft offers a staff test registration with a
 * warning that it is real; once they hold a ticket, the ordinary panel shows
 * it. A paid draft shows no button: the database refuses paid test
 * registrations, so no card is ever held for one. `checkoutAvailable` is false
 * while the checkout route is behind the student-events flag.
 */
export function DraftTestRegistration({
  event,
  user,
  state,
  checkoutAvailable,
}: PanelProps & {
  event: PanelProps["event"] & Pick<EventRow, "status">;
  checkoutAvailable: boolean;
}) {
  if (state.kind === "reg-going" || state.kind === "reg-checked-in") {
    return <RegistrationPanel event={event} user={user} state={state} />;
  }
  if (!checkoutAvailable || !allowsStaffTestRegistration(event)) {
    return (
      <Button disabled>
        {checkoutAvailable ? "Paid drafts can’t be test-registered" : "Registration unavailable in draft preview"}
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="warning" className="w-full">
        <AlertTitle>UX Hub execs only</AlertTitle>
        <AlertDescription>{STAFF_TEST_REGISTRATION_WARNING}</AlertDescription>
      </Alert>
      <Button asChild>
        <FlowLink href={`/portal/events/${event.slug}/checkout`}>{STAFF_TEST_REGISTRATION_LABEL}</FlowLink>
      </Button>
    </div>
  );
}
