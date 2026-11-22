"use client";

import { useId, useState } from "react";
import { Pencil, ShieldCheck } from "lucide-react";

import {
  RecordField,
  RecordFrame,
  RecordPage,
  RecordSection,
  RecordThumbnail,
  RecordView,
} from "@/components/shared/RecordDrawer";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowButton,
} from "@/components/ui/table";

import { EventRegistrationsCard, type EventRegistrationsCardProps } from "@/features/admin/components/EventRegistrationsCard";
import { EVENT_MANAGER_COLUMN, EventManagerHeader } from "@/features/admin/components/event-manager/EventManagerHeader";
import { eventManagerHref, eventManagerTabs } from "@/features/admin/lib/event-manager";
import type { EventRow } from "@/lib/supabase/models";
import { Composition } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

const PATH = "/dev/components/record-drawer";

interface Person {
  id: string;
  name: string;
  pronouns: string;
  email: string;
  phone: string;
  membership: string | null;
  major: string;
  since: string;
}

const PEOPLE: Person[] = [
  { id: "u2", name: "Priya Raman", pronouns: "she/her", email: "priya.raman@student.ubc.ca", phone: "604-555-0190", membership: "Innovator", major: "Psychology", since: "July 21, 2026" },
  { id: "u3", name: "Jordan Lee", pronouns: "they/them", email: "jordan.lee@gmail.com", phone: "", membership: null, major: "Business", since: "September 3, 2026" },
];

interface DemoEvent {
  id: string;
  name: string;
  when: string;
  /** The event's square icon (`image_url`), or none. */
  image: string | null;
  location: string;
  capacity: string;
  /** What the At a glance card shows. */
  registrations: Omit<EventRegistrationsCardProps, "eventId">;
}

const EVENTS: DemoEvent[] = [
  { id: "e1", name: "Portfolio Night", when: "Thursday, October 9, 2026 · 6:00 – 9:00 PM", image: "/about-us-1.png", location: "AMS Nest, Room 2306", capacity: "80",
    // Takes applications: the card breaks them down. 6 offers out hold seats.
    registrations: { capacity: 80, tickets: 52, heldOffers: 6, seatsLeft: 22, checkedIn: 0, applications: { submitted: 3, accepted: 58, waitlisted: 9, rejected: 14, total: 84 } } },
  { id: "e2", name: "Design Systems Workshop with a Very Long Name for Wrapping", when: "Saturday, November 14, 2026 · 1:00 – 4:00 PM", image: null, location: "Hugh Dempster Pavilion 110", capacity: "No limit",
    // Open registration with no capacity: a count, no bar.
    registrations: { capacity: null, tickets: 17, heldOffers: 0, seatsLeft: null, checkedIn: 0 } },
];

/** The first event, as the manager's header reads it. */
const MANAGER_EVENT = {
  id: "e1",
  name: EVENTS[0].name,
  image_url: EVENTS[0].image,
  status: "active",
  publish_at: null,
  canceled_at: null,
  requires_application: true,
  teams_enabled: true,
  slug: "portfolio-night",
  marketing_url: null,
  configured_marketing_mode: null,
  configured_marketing_url: null,
  starts_at: "2026-10-10T01:00:00.000Z",
  ends_at: "2026-10-10T04:00:00.000Z",
  location_building: "AMS Nest",
  location_room: "2306",
} as EventRow;

/** An event's overview, as AdminEventRecord shows it: its square icon beside the title. */
function EventRecord({ event }: { event: DemoEvent }) {
  return (
    <RecordView
      title={event.name}
      // Expand morphs this drawer into the manager's full page, as in the app.
      fullPageHref={`${PATH}?open=page`}
      subtitle={event.when}
      media={<RecordThumbnail src={event.image} />}
      status={
        <>
          <Badge variant="success">Published</Badge>
          <Badge variant="info">Registration open</Badge>
        </>
      }
      actions={
        <Button variant="secondary" size="sm">
          <Pencil aria-hidden /> Edit event
        </Button>
      }
      details={
        <>
          <RecordSection title="At a glance" kind="content">
            <EventRegistrationsCard eventId={event.id} {...event.registrations} />
          </RecordSection>
          {/* Read-only here: the status and schedule are changed on the manager's Overview. */}
          <RecordSection
            title="Status and registration schedule"
            action={
              <Button asChild variant="secondary" size="sm">
                <a href={`${PATH}?open=page`}>
                  <Pencil aria-hidden /> Change on Overview
                </a>
              </Button>
            }
          >
            <RecordField label="Status" value={<Badge variant="success">Published</Badge>} />
            <RecordField label="Starts" value={event.when} />
            <RecordField label="Registration opens" value="As soon as it’s active" />
            <RecordField label="Registration closes" value="No closing date" />
          </RecordSection>
          <RecordSection title="Venue">
            <RecordField label="Location" value={event.location} />
            <RecordField label="Capacity" value={event.capacity} />
          </RecordSection>
        </>
      }
    />
  );
}

const PHONE = /^\d{3}-\d{3}-\d{4}$/;

type Start = "view" | "edit" | "error";

/**
 * What a feature's record component looks like: it owns the draft and the
 * save, and hands RecordView the state.
 */
function PersonRecord({ person, start, onSaved }: { person: Person; start: Start; onSaved: (person: Person) => void }) {
  const ids = useId();
  const [editing, setEditing] = useState(start !== "view");
  const [draft, setDraft] = useState(start === "error" ? { phone: "604-555", major: person.major } : { phone: person.phone, major: person.major });
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(start === "error" ? "Enter a phone number like 604-555-0190." : null);
  const [error, setError] = useState<string | null>(start === "error" ? "Couldn’t save. Check the phone number and try again." : null);
  const dirty = editing && (draft.phone !== person.phone || draft.major !== person.major);

  const cancel = () => {
    setDraft({ phone: person.phone, major: person.major });
    setPhoneError(null);
    setError(null);
    setEditing(false);
  };

  const save = () => {
    if (draft.phone && !PHONE.test(draft.phone)) {
      setPhoneError("Enter a phone number like 604-555-0190.");
      setError("Couldn’t save. Check the phone number and try again.");
      return;
    }
    setPhoneError(null);
    setError(null);
    setSaving(true);
    window.setTimeout(() => {
      onSaved({ ...person, ...draft });
      setSaving(false);
      setEditing(false);
    }, 700);
  };

  return (
    <RecordView
      title={person.name}
      titleAdornment={
        <>
          <ShieldCheck className="size-4 text-primary" aria-label="Verified student" />
          <span className="text-small text-muted-foreground">{person.pronouns}</span>
        </>
      }
      subtitle={`User since ${person.since}`}
      media={<Avatar name={person.name} size={64} decorative />}
      status={
        person.membership ? <Badge variant="info">{person.membership}</Badge> : <Badge variant="neutral">No membership</Badge>
      }
      actions={
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden /> Edit user
        </Button>
      }
      editing={editing}
      dirty={dirty}
      saving={saving}
      error={error}
      onCancel={cancel}
      onSave={save}
      details={
        <>
          <RecordSection title="Contact">
            <RecordField label="Email" value={person.email} />
            <RecordField label="Phone" value={person.phone} htmlFor={`${ids}-phone`} error={phoneError}>
              <Input
                id={`${ids}-phone`}
                type="tel"
                autoComplete="off"
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              />
            </RecordField>
            <RecordField label="Newsletter" value="Subscribed" />
          </RecordSection>
          <RecordSection title="Membership">
            <RecordField label="Tier" value={person.membership ?? "No membership"} />
            <RecordField label="Area of study" value={person.major} htmlFor={`${ids}-major`} description="As the student entered it at sign-up.">
              <Input
                id={`${ids}-major`}
                value={draft.major}
                onChange={(event) => setDraft((current) => ({ ...current, major: event.target.value }))}
              />
            </RecordField>
            <RecordField label="Student number" value={null} />
          </RecordSection>
          <RecordSection title="Recent transactions" kind="content">
            {person.membership ? (
              <div className="flex flex-col gap-3">
                <TransactionRow title="2026–27 membership" description={person.membership} amountCents={-1500} date="Sept 27, 2026" media={<div className="size-full bg-ux-hub" />} />
                <TransactionRow title="Portfolio Night" description="Event ticket" amountCents={-500} date="Oct 9, 2026" media={<div className="size-full bg-muted" />} />
              </div>
            ) : (
              <p className="text-body text-muted-foreground">No purchases yet.</p>
            )}
          </RecordSection>
        </>
      }
    />
  );
}

function RecordDrawerDemo({ open }: SectionProps) {
  // A fresh demo per `?open=` state, as each chip starts from scratch.
  return <Demo key={open ?? "none"} state={open} />;
}

function Demo({ state }: { state: string | undefined }) {
  const drawerStart: Start | null =
    state === "drawer" ? "view" : state === "drawer-edit" ? "edit" : state === "drawer-error" ? "error" : null;
  const [people, setPeople] = useState(PEOPLE);
  const [open, setOpen] = useState(Boolean(drawerStart));
  // Stays set after closing, so the drawer slides out with its content.
  const [personIndex, setPersonIndex] = useState(0);
  // Which list the open record belongs to; also kept after closing.
  const [kind, setKind] = useState<"person" | "event">("person");
  const [eventIndex, setEventIndex] = useState(0);
  // Each opening is a fresh record, as each navigation from the list is.
  const [session, setSession] = useState(0);
  const [start, setStart] = useState<Start>(drawerStart ?? "view");

  const saved = (person: Person) =>
    setPeople((current) => current.map((item) => (item.id === person.id ? person : item)));

  if (state === "page") {
    return (
      <Composition
        title="Full page: the event manager"
        description="Users only ever open in the drawer. An event’s expand button beside close opens its manager, a page of its own at /admin/events/<id>/overview (RecordPage in the manager’s layout) that wears the drawer’s top bar on every tab (Overview, Agenda, Check-in, Teams, Applications) in place of a back pill: close returns to the list, collapse returns to the list with the event’s drawer open, whichever tab is showing. Expand and collapse morph: the drawer’s panel grows into the page, or the page shrinks back into the drawer, while the list (RecordList) fades out or in; not on phones, with reduced motion, or in browsers without view transitions, where the page swaps instantly. Opening, closing and swapping records keep the drawer’s own slide. Below sm only close shows, and on phones the manager hides the app header. “Edit event” opens the builder, a plain page that starts with a “Back to event” pill to Overview. Here close goes to this page and collapse to ?open=drawer, which morphs this box into the drawer."
      >
        <RecordPage
          className="overflow-hidden rounded-xl border border-border-subtle"
          listHref={PATH}
          listLabel="Back to Manage Events"
          recordHref={`${PATH}?open=drawer`}
        >
          <EventManagerHeader
            event={MANAGER_EVENT}
            tabs={eventManagerTabs(MANAGER_EVENT.id, MANAGER_EVENT, { applicationsToReview: 3 })}
            publicPages
            pathname={eventManagerHref(MANAGER_EVENT.id)}
          />
          <div className={`${EVENT_MANAGER_COLUMN} grid gap-6 pb-10 pt-8 lg:grid-cols-2 lg:items-start`}>
            {/* Overview's left column (Needs action, the registrations list) is elided here. */}
            <div className="h-40 rounded-lg border border-dashed border-border" aria-hidden />
            <EventRegistrationsCard eventId={MANAGER_EVENT.id} {...EVENTS[0].registrations} />
          </div>
        </RecordPage>
      </Composition>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Composition
        title="Manage Users"
        description="Open a person, then edit their phone number or area of study. Another row swaps the record without replaying the slide-in; Escape and the chevron close it. With unsaved edits, closing or following any link on this page (the docs sidebar too) asks first. In the app the list is a route layout and each record a child route, so the drawer is the URL (a refresh shows the list with the drawer open) and rows are TableRowLinks wired by useRecordRows; here they are TableRowButtons. The open record's row carries aria-current, which fills it."
      >
        <TableCard className="max-w-2xl">
          <Table stickyFirstColumn className="min-w-[32rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Membership</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person, index) => (
                <TableRow key={person.id}>
                  <TableCell className="whitespace-nowrap">
                    <TableRowButton
                      aria-current={(open && kind === "person" && personIndex === index) || undefined}
                      onClick={() => {
                        if (!open) setSession((current) => current + 1);
                        setStart("view");
                        setKind("person");
                        setPersonIndex(index);
                        setOpen(true);
                      }}
                    >
                      {person.name}
                    </TableRowButton>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{person.email}</TableCell>
                  <TableCell className="text-muted-foreground">{person.membership ?? <TableNone />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </Composition>

      <Composition
        title="Manage Events"
        description="An event's square icon (its image_url, which the builder crops to 1:1) sits beside the title in a RecordThumbnail, where a person has their Avatar: 96 px (80 px on phones), rounded, cropped to fill. An event with no icon, or one whose image fails to load, shows an image placeholder on the muted fill instead."
      >
        <TableCard className="max-w-2xl">
          <Table stickyFirstColumn className="min-w-[32rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Icon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EVENTS.map((event, index) => (
                <TableRow key={event.id}>
                  <TableCell className="max-w-72 truncate">
                    <TableRowButton
                      aria-current={(open && kind === "event" && eventIndex === index) || undefined}
                      onClick={() => {
                        if (!open) setSession((current) => current + 1);
                        setKind("event");
                        setEventIndex(index);
                        setOpen(true);
                      }}
                    >
                      {event.name}
                    </TableRowButton>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.image ? "Uploaded" : <TableNone />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </Composition>

      <RecordFrame listHref={PATH} open={open} onClose={() => setOpen(false)}>
        {kind === "event" ? (
          <EventRecord key={`${session}-${EVENTS[eventIndex].id}`} event={EVENTS[eventIndex]} />
        ) : (
          <PersonRecord
            key={`${session}-${people[personIndex].id}`}
            person={people[personIndex]}
            start={start}
            onSaved={saved}
          />
        )}
      </RecordFrame>
    </div>
  );
}

export default RecordDrawerDemo;
