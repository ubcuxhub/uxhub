"use client";

import { useEffect, useState } from "react";
import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";

interface EventRegistrationActionProps {
  eventId: string;
  eventSlug: string;
  registrationAvailable: boolean;
  unavailableLabel: string;
}

export function EventRegistrationAction({
  eventId,
  eventSlug,
  registrationAvailable,
  unavailableLabel,
}: EventRegistrationActionProps) {
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkRegistration() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const user = await fetchUserInfoByAuthId(supabase, session.user.id);
      if (!user) return;
      const ticket = await fetchUserEventTicket(supabase, eventId, user.id);
      if (active) setAlreadyRegistered(Boolean(ticket));
    }

    void checkRegistration().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [eventId]);

  if (alreadyRegistered) {
    return (
      <Button disabled className="self-start">
        Already Registered
      </Button>
    );
  }

  if (!registrationAvailable) {
    return (
      <Button disabled className="self-start">
        {unavailableLabel}
      </Button>
    );
  }

  return (
    <Button asChild className="self-start">
      <FlowLink href={`/portal/events/${eventSlug}/checkout`}>
        Register Now
      </FlowLink>
    </Button>
  );
}
