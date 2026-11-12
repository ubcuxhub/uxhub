"use client";

import { Ticket } from "@/components/shared/Ticket";
import { RegistrationTicket } from "@/components/shared/RegistrationTicket";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toQrSvg } from "@/features/events/lib/qr-code";

interface Props {
  eventName: string;
  eventColour?: string | null;
  holderName: string;
  checkedIn: boolean;
  /** Signed on the server for the authenticated attendee's own ticket. */
  qrToken: string;
  participantPackages: { id: string; label: string | null; url: string }[];
}

export function EventRegistrationTicket({ eventName, eventColour, holderName, checkedIn, qrToken, participantPackages }: Props) {
  const code = toQrSvg(qrToken);
  const qr = (className: string) => <svg role="img" aria-label="Check-in QR code" viewBox={`0 0 ${code.size} ${code.size}`} shapeRendering="crispEdges" className={className}>
    <path d={code.path} fill="currentColor" />
  </svg>;

  return <Dialog>
    <RegistrationTicket
      title={`You're going to ${eventName}`}
      description="Show your ticket at check-in."
      ticket={<Ticket eventName={eventName} eventColour={eventColour ?? undefined} holderName={holderName} state={checkedIn ? "used" : "active"} code={qr("size-full")} />}
      actions={<>
        <DialogTrigger asChild><Button>View ticket</Button></DialogTrigger>
        {participantPackages.map((link) => <Button key={link.id} variant="secondary" asChild>
          <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label === "Participant package" || !link.label ? "View participant package" : link.label}</a>
        </Button>)}
      </>}
    />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Your ticket for {eventName}</DialogTitle>
        <DialogDescription>Show this code at check-in.</DialogDescription>
      </DialogHeader>
      <p className="text-body-medium">{holderName}</p>
      {checkedIn && <p className="text-small text-muted-foreground">Checked in</p>}
      {qr("mx-auto size-48 max-w-full rounded-lg bg-white text-black")}
    </DialogContent>
  </Dialog>;
}
