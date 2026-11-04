import { QrCode } from "lucide-react";

import { Ticket } from "@/components/shared/Ticket";
import { Button } from "@/components/ui/button";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** A static stand-in for the real QR, which the event page supplies. */
function Qr() {
  return <QrCode aria-hidden className="size-8" strokeWidth={1.5} />;
}

const holder = { eventName: "Design Sprint", holderName: "John Doe" };

function ViewTicket() {
  return (
    <Button variant="secondary" size="sm">
      View ticket
    </Button>
  );
}

function Section() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        surface="page"
        title="Event colour"
        spec="§2.1"
        description="The fill is the event colour mixed with white at the top. The label is white or near-black, whichever contrasts more."
      >
        <Specimen label="Blue #325DC4 (default)" className="w-96">
          <Ticket {...holder} code={<Qr />} />
        </Specimen>
        <Specimen label="Orchid #C983C7" className="w-96">
          <Ticket {...holder} eventColour="#C983C7" code={<Qr />} />
        </Specimen>
        <Specimen label="Slate #4A5E8A" className="w-96">
          <Ticket {...holder} eventColour="#4A5E8A" code={<Qr />} />
        </Specimen>
        <Specimen label="Custom, pale #F3E9C6 (dark label)" className="w-96">
          <Ticket {...holder} eventColour="#F3E9C6" code={<Qr />} />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="State" spec="§4.3" surface="page">
        <Specimen label="Pending: greyed, no code" className="w-96">
          <Ticket {...holder} state="pending" caption="Confirm by Nov 14" />
        </Specimen>
        <Specimen label="Used: checked in, dimmed code" className="w-96">
          <Ticket {...holder} state="used" code={<Qr />} />
        </Specimen>
        <Specimen label="With action" className="w-96">
          <Ticket {...holder} code={<Qr />} action={<ViewTicket />} />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Mobile width"
        description="The ticket scales down with its container, and long names truncate."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="w-80 max-w-full">
            <Ticket {...holder} code={<Qr />} />
          </div>
          <div className="w-80 max-w-full">
            <Ticket
              eventName="Design Sprint with a very long event name"
              holderName="Alexandria Montgomery-Smith"
              eventColour="#C983C7"
              state="pending"
              caption="Confirm by Nov 14"
            />
          </div>
          <div className="w-80 max-w-full">
            <Ticket {...holder} code={<Qr />} action={<ViewTicket />} />
          </div>
        </div>
      </Composition>
    </div>
  );
}

export default Section;
