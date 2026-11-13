"use client";

import { useId, useState } from "react";
import { CalendarDays, Clock, Info, MapPin, Ticket as TicketIcon } from "lucide-react";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { EventCard, EventCardDates } from "@/components/shared/EventCard";
import { Hubbo } from "@/components/shared/Hubbo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchField } from "@/components/ui/search-field";
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { ToastView, toast } from "@/components/ui/toast";
import { EventTicket } from "@/features/events/components/EventTicket";

import { ART_BLUE, HERE, PEOPLE, QR_TOKEN } from "../_fixtures";
import { LIFT, Panel } from "./frame";
import type { Components } from "./types";

const TICKETS = [
  { value: "member", label: "Member", description: "Active UX Hub membership", price: 10 },
  { value: "student", label: "Student", description: "Any UBC student", price: 15 },
  { value: "guest", label: "Guest", description: "Not a student", price: 20 },
] as const;

const money = (dollars: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(dollars);

function Meta({ icon: Icon, children }: { icon: typeof Clock; children: string }) {
  return (
    <li className="flex items-start gap-2 text-small text-muted-foreground">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function EventRegistration() {
  const uid = useId();
  const [ticket, setTicket] = useState<string>("member");
  const [agreed, setAgreed] = useState(false);
  const [registered, setRegistered] = useState(false);
  const price = TICKETS.find((option) => option.value === ticket)?.price ?? 0;

  return (
    <Panel>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-h3">UXathon 2027</CardTitle>
          <StatusBadge status={registered ? "going" : "registration_open"} />
        </div>
        <ul className="flex flex-col gap-1.5">
          <Meta icon={CalendarDays}>Sat, Jan 9 – Sun, Jan 10</Meta>
          <Meta icon={Clock}>9:00 AM – 7:00 PM</Meta>
          <Meta icon={MapPin}>UBC Henry Angus (ANGU)</Meta>
        </ul>
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <AvatarGroup people={PEOPLE} max={4} size={28} />
          128 going
        </div>
      </CardHeader>
      <Separator className="bg-border-subtle" />
      <CardContent className="flex flex-col gap-5">
        <FieldSet>
          <FieldLegend variant="label">Ticket</FieldLegend>
          <RadioGroup value={ticket} onValueChange={setTicket} className="gap-2">
            {TICKETS.map((option) => (
              <FieldLabel key={option.value} htmlFor={`${uid}-${option.value}`}>
                <Field orientation="horizontal">
                  <RadioGroupItem value={option.value} id={`${uid}-${option.value}`} />
                  <FieldContent>
                    <FieldTitle>{option.label}</FieldTitle>
                    <FieldDescription>{option.description}</FieldDescription>
                  </FieldContent>
                  <span className="text-body-medium tabular-nums">{money(option.price)}</span>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field orientation="horizontal">
          <Checkbox
            id={`${uid}-agree`}
            checked={agreed}
            onCheckedChange={setAgreed}
          />
          <FieldLabel htmlFor={`${uid}-agree`} className="text-small font-normal">
            I agree to the UX Hub code of conduct
          </FieldLabel>
        </Field>
        <Button
          className="w-full"
          disabled={!agreed || registered}
          onClick={() => {
            setRegistered(true);
            toast.success("You’re going to UXathon 2027", {
              description: "Your ticket is on the event page.",
            });
          }}
        >
          {registered ? "Registered" : `Register · ${money(price)}`}
        </Button>
      </CardContent>
    </Panel>
  );
}

function FeaturedEvent() {
  return (
    <EventCard
      title="Portfolio Night"
      href={HERE}
      venue="UBC Nest Room 3300"
      when={
        <EventCardDates
          lines={[{ day: "Sat, Jan 30", time: "6:00 – 9:00 PM" }]}
        />
      }
      status={{ status: "register_by", date: "Jan 20" }}
      image={{ src: ART_BLUE }}
      // A 360px card is phone-sized, but the viewport is not: keep the
      // thumbnail stacked above the text as it is on phones.
      className={`sm:flex-col-reverse sm:items-stretch sm:gap-4 sm:p-4 [&_[data-slot=event-card-thumbnail]]:sm:h-35 [&_[data-slot=event-card-thumbnail]]:sm:w-full ${LIFT}`}
    />
  );
}

function ScannableTicket() {
  return (
    <EventTicket
      className={LIFT}
      eventName="Intro to Figma Workshop"
      holderName="Alex Chen"
      qrToken={QR_TOKEN}
    />
  );
}

const DISCOUNT = "UXHUB10";

function CheckoutSummary() {
  const uid = useId();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discount = applied ? 1 : 0;

  return (
    <Panel>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DetailList>
          <DetailRow label="Event">UXathon 2027</DetailRow>
          <DetailRow label="Ticket">Member · {money(10)}</DetailRow>
          <DetailRow label="Discount">{applied ? `${DISCOUNT} · −${money(discount)}` : null}</DetailRow>
          <DetailRow label="Total">
            <span className="text-body-medium tabular-nums">{money(10 - discount)}</span>
          </DetailRow>
        </DetailList>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-code`}>Discount code</FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`${uid}-code`}
              value={code}
              placeholder={DISCOUNT}
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-code-error` : undefined}
              disabled={applied}
            />
            <Button
              variant="secondary"
              disabled={applied || !code.trim()}
              onClick={() => {
                if (code.trim().toUpperCase() === DISCOUNT) setApplied(true);
                else setError(`Try ${DISCOUNT}.`);
              }}
            >
              Apply
            </Button>
          </div>
          {error ? <FieldError id={`${uid}-code-error`}>{error}</FieldError> : null}
        </Field>
        <Alert variant="info" icon={<Info />}>
          <AlertTitle>Tickets can’t be refunded</AlertTitle>
          <AlertDescription>You can transfer yours until Jan 8.</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="border-t pt-5 [.border-t]:pt-5">
        <Button className="w-full">
          <TicketIcon aria-hidden />
          Pay {money(10 - discount)}
        </Button>
      </CardFooter>
    </Panel>
  );
}

function Toasts() {
  return (
    <Panel className="gap-3 bg-section px-4 py-4 [--width:100%]">
      <ToastView
        tone="success"
        message="Event published"
        description="UXathon 2027 is live on the events page."
        onDismiss={() => {}}
      />
      <ToastView
        tone="neutral"
        message="Draft saved"
        action={{ label: "Undo", onClick: () => {} }}
        onDismiss={() => {}}
      />
      <ToastView
        tone="error"
        message="Couldn’t send the reminder"
        description="Check your connection and try again."
        action={{ label: "Retry", onClick: () => {} }}
        onDismiss={() => {}}
      />
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => toast.success("Reminder sent to 128 attendees")}
      >
        Send a real toast
      </Button>
    </Panel>
  );
}

function NoEvents() {
  return (
    <Panel className="py-0">
      <EmptyState
        media={<Hubbo emotion="resting" size="card" />}
        title="No upcoming events"
        description="We’re planning the next one. Check back soon, or look through past events."
        actions={
          <Button size="sm" variant="secondary">
            View past events
          </Button>
        }
      />
    </Panel>
  );
}

const LISTED: { name: string; when: string; status: Status | null; past: boolean }[] = [
  { name: "UXathon 2027", when: "Sat, Jan 9", status: "going", past: false },
  { name: "Intro to Figma Workshop", when: "Mon, Jan 25", status: "registration_open", past: false },
  { name: "Portfolio Night", when: "Sat, Jan 30", status: "full", past: false },
  { name: "Design Crit Night", when: "Tue, Oct 6", status: "past", past: true },
  { name: "Fall Kickoff", when: "Tue, Sep 15", status: "past", past: true },
];

function EventSearch() {
  const [query, setQuery] = useState("portfolo");
  const [when, setWhen] = useState("upcoming");
  const needle = query.trim().toLowerCase();
  const shown = LISTED.filter(
    (item) =>
      item.past === (when === "past") && (!needle || item.name.toLowerCase().includes(needle)),
  );
  return (
    <Panel>
      <CardHeader className="gap-3">
        <SegmentedToggle aria-label="Show events" value={when} onValueChange={setWhen} className="w-full">
          <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
          <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
        </SegmentedToggle>
        <SearchField
          label="Search events"
          placeholder="Search events"
          value={query}
          onValueChange={setQuery}
          resultCount={shown.length}
        />
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <EmptyState
            className="px-0 py-4"
            media={<Hubbo emotion="curious" size="card" />}
            title={`No events match “${query.trim()}”`}
            description="Check the spelling, or try a venue or a month."
            actions={
              <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-3 py-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-small font-medium">{item.name}</span>
                  <span className="text-label font-normal text-muted-foreground">{item.when}</span>
                </span>
                {item.status ? <StatusBadge status={item.status} /> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Panel>
  );
}

export const EVENT_COMPONENTS = {
  "event-registration": EventRegistration,
  "featured-event": FeaturedEvent,
  "event-ticket": ScannableTicket,
  "checkout-summary": CheckoutSummary,
  "toasts": Toasts,
  "no-events": NoEvents,
  "event-search": EventSearch,
} satisfies Components;
