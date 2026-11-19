"use client";

import { CheckoutLayout } from "@/components/shared/CheckoutLayout";
import { CheckoutPaymentSection } from "@/components/shared/CheckoutPaymentSection";
import { Button } from "@/components/ui/button";
import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { UserInfoRow } from "@/lib/supabase/models";

const user = { id: "demo", email: "member@example.test", first_name: "Demo", last_name: "Member", phone: null } as UserInfoRow;

export default function CheckoutDemo() {
  return <SpecimenGroup title="Checkout" description="Compare cardless event registration, paid event checkout and membership checkout at phone/desktop widths, both themes/densities and 200% zoom. These specimens cannot submit. Paid specimens skip Square initialization because they are disabled. Free requests retain their attempt key on timeouts and show errors without losing the summary.">
    {[0, 12.5].map(price => <Specimen key={price} label={price === 0 ? "free event" : "paid event"} wide>
      <CheckoutLayout backAction={<Button variant="outline">Back</Button>} description="Review your ticket for Design Sprint." item={{ name: "Design Sprint", details: "November 20 · UBC" }} payment={{ disabled: true, kind: "event_ticket", slug: "demo", successHref: () => "/dev/components/checkout" }} price={price} processingMessage="We’re confirming your registration." user={user} />
    </Specimen>)}
    <Specimen label="free registration unavailable" wide>
      <CheckoutPaymentSection amount="$0.00" amountCents={0} title="Confirm registration" disabled disabledMessage="This event is sold out." initialEmail={user.email} initialFirstName={user.first_name} initialLastName={user.last_name} kind="event_ticket" slug="demo" userId={user.id} />
    </Specimen>
    <Specimen label="membership payment contract" wide>
      <CheckoutPaymentSection amount="$20.00" amountCents={2000} disabled initialEmail={user.email} initialFirstName={user.first_name} initialLastName={user.last_name} kind="membership" slug="demo" userId={user.id} />
    </Specimen>
  </SpecimenGroup>;
}
