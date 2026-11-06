"use client";

import { useId, useState } from "react";
import { Pencil, ShieldCheck } from "lucide-react";

import { RecordField, RecordFrame, RecordSection, RecordView } from "@/components/shared/RecordDrawer";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const PHONE = /^\d{3}-\d{3}-\d{4}$/;

type Start = "view" | "edit" | "error";

/**
 * What a feature's record component looks like: it owns the draft and the
 * save, and hands RecordView the state. It never asks which mode it is in.
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
      recordHref={`${PATH}?open=page`}
      title={person.name}
      titleAdornment={
        <>
          <ShieldCheck className="size-5 text-primary" aria-label="Verified student" />
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

function RecordDrawerDemo({ open: state }: SectionProps) {
  const drawerStart: Start | null =
    state === "drawer" ? "view" : state === "drawer-edit" ? "edit" : state === "drawer-error" ? "error" : null;
  const [people, setPeople] = useState(PEOPLE);
  const [open, setOpen] = useState(Boolean(drawerStart));
  // Stays set after closing, so the drawer slides out with its content.
  const [personIndex, setPersonIndex] = useState(0);
  // Each opening is a fresh frame, as each soft navigation to a record is.
  const [session, setSession] = useState(drawerStart ? 1 : 0);
  const [start, setStart] = useState<Start>(drawerStart ?? "view");

  const saved = (person: Person) =>
    setPeople((current) => current.map((item) => (item.id === person.id ? person : item)));

  if (state === "page") {
    return (
      <Composition
        title="Full page"
        description="The same content at the record’s own URL, for a refresh, a shared link or “Open as full page”. The back pill names the list; unsaved edits ask before it leaves."
      >
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
          <RecordFrame mode="canonical" listHref={PATH} listLabel="Back to Manage Users">
            <PersonRecord person={people[0]} start="view" onSaved={saved} />
          </RecordFrame>
        </div>
      </Composition>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Composition
        title="Manage Users"
        description="Open a person, then edit their phone number or area of study. Another row swaps the record; Escape and the chevron close it. With unsaved edits, closing or following any link on this page (the docs sidebar too) asks first. These rows are buttons; in the app they are links (AdminDirectoryTable), so they ask too."
      >
        <div className="max-w-2xl rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-subheading">Members</h3>
          <div className="divide-y divide-border-subtle">
            {people.map((person, index) => (
              <button
                key={person.id}
                type="button"
                aria-current={(open && personIndex === index) || undefined}
                onClick={() => {
                  if (!open) setSession((current) => current + 1);
                  setStart("view");
                  setPersonIndex(index);
                  setOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent focus-visible:focus-ring aria-[current=true]:bg-muted"
              >
                <Avatar name={person.name} size={40} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-medium">{person.name}</span>
                  <span className="block text-small text-muted-foreground">{person.email}</span>
                </span>
                <span className="text-small text-muted-foreground">{person.membership ?? "No membership"}</span>
              </button>
            ))}
          </div>
        </div>
      </Composition>

      {session > 0 ? (
        <RecordFrame key={session} mode="intercepted" listHref={PATH} listLabel="Back to Manage Users" onClose={() => setOpen(false)}>
          <PersonRecord key={people[personIndex].id} person={people[personIndex]} start={start} onSaved={saved} />
        </RecordFrame>
      ) : null}
    </div>
  );
}

export default RecordDrawerDemo;
