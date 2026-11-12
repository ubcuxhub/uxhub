import { QrCode } from "lucide-react";

import { Composition } from "@/app/dev/_shell/Specimen";
import { RegistrationTicket } from "@/components/shared/RegistrationTicket";
import { Ticket } from "@/components/shared/Ticket";
import { Button } from "@/components/ui/button";

function Example({ used = false, packageLink = true }: { used?: boolean; packageLink?: boolean }) {
  return <RegistrationTicket
    title="You're going to Portfolio Review Night"
    description="Show your ticket at check-in."
    ticket={<Ticket eventName="Portfolio Review Night" holderName="Aubrey Ventura" state={used ? "used" : "active"} code={<QrCode aria-hidden className="size-12" />} />}
    actions={<>
      <Button disabled>View ticket</Button>
      {packageLink && <Button variant="secondary" disabled>View participant package</Button>}
    </>}
  />;
}

export default function Section() {
  return <div className="space-y-8">
    <Composition title="Full-width registration" description="Figma 4619:149. Text and natural-width actions beside the 444px ticket once the card reaches 56rem. Preview actions are disabled; the event feature owns the QR dialog and authorized resource links.">
      <Example />
    </Composition>
    <Composition title="Phone and half-width cards" description="The container controls stacking: text, ticket, then full-width actions. No package button appears without an accessible configured package.">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="w-full max-w-[390px]"><Example /></div>
        <div className="w-full max-w-[444px]"><Example used packageLink={false} /></div>
      </div>
    </Composition>
  </div>;
}
