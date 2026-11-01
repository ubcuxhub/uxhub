"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Pencil, ShieldCheck } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidePeekDrawer, SidePeekDrawerBody, SidePeekDrawerContent, SidePeekDrawerFooter, SidePeekDrawerHeader, SidePeekDrawerTitle } from "@/components/ui/side-peek-drawer";
import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { TransactionRow } from "@/components/shared/TransactionRow";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const PEOPLE = [
  { name: "Jane Smith", email: "jane.smith@example.com", membership: "Innovator" },
  { name: "Alex Chen", email: "alex.chen@example.com", membership: "Explorer" },
] as const;

function Section({ open: initialState }: SectionProps) {
  const [open, setOpen] = useState(Boolean(initialState));
  const [personIndex, setPersonIndex] = useState(0);
  const [savedNames, setSavedNames] = useState<string[]>(PEOPLE.map((person) => person.name));
  const [editing, setEditing] = useState(initialState === "drawer-edit" || initialState === "drawer-unsaved");
  const [name, setName] = useState<string>(initialState === "drawer-unsaved" ? "Jane Smit" : PEOPLE[0].name);
  const janeRef = useRef<HTMLButtonElement>(null);
  const alexRef = useRef<HTMLButtonElement>(null);
  const rowRefs = [janeRef, alexRef];
  const person = { ...PEOPLE[personIndex], name: savedNames[personIndex] };
  const dirty = editing && name !== person.name;

  useEffect(() => {
    if (initialState === "drawer-unsaved") {
      const frame = requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Close panel (Esc)"]')?.click(),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [initialState]);

  const selectPerson = (index: number) => {
    setPersonIndex(index);
    setName(savedNames[index]);
    setEditing(false);
    setOpen(true);
  };

  const membershipMedia = <div className="size-full bg-ux-hub" />;
  const awardMedia = <div className="size-full bg-linear-to-br from-slate-600 to-slate-400" />;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Read-only record parts" spec="§3.15" min="min(28rem, 100%)" description="Details are text, not disabled fields. Transactions show a sign, colour and spoken charge or credit cue.">
        <Specimen label="Detail rows" bare>
          <DetailList className="rounded-xl border border-border-subtle bg-card px-4">
            <DetailRow label="Email">jane.smith@example.com</DetailRow>
            <DetailRow label="Phone" />
            <DetailRow label="Membership">Innovator</DetailRow>
          </DetailList>
        </Specimen>
        <Specimen label="Payment and credit" bare>
          <div className="flex w-full flex-col gap-3">
            <TransactionRow title="2026–27 membership" description="Innovator" amountCents={-1500} date="Sept 27, 2026" media={membershipMedia} />
            <TransactionRow title="UXathon 2025 · First place" description="Competition award" amountCents={10000} date="Jan 14, 2025" media={awardMedia} />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition title="Manage Users" description="Open a person, edit their name, or select another row while the panel is open. Escape and Close return focus to the selected row; unsaved edits ask before closing.">
        <div className="max-w-2xl rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-subheading">Members</h3>
          <div className="divide-y divide-border-subtle">
            {PEOPLE.map((item, index) => (
              <button
                key={item.email}
                ref={rowRefs[index]}
                type="button"
                aria-expanded={open && personIndex === index}
                onClick={() => selectPerson(index)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent focus-visible:focus-ring aria-expanded:bg-muted"
              >
                <Avatar name={savedNames[index]} size={40} decorative />
                <span className="min-w-0 flex-1"><span className="block text-body-medium">{savedNames[index]}</span><span className="block text-small text-muted-foreground">{item.email}</span></span>
                <span className="text-small text-muted-foreground">{item.membership}</span>
              </button>
            ))}
          </div>
        </div>
      </Composition>

      <SidePeekDrawer open={open} onOpenChange={setOpen} dirty={dirty} returnFocusRef={rowRefs[personIndex]}>
        <SidePeekDrawerContent aria-describedby={undefined}>
          <SidePeekDrawerHeader
            fullPageHref={`/admin/users/${personIndex + 1}`}
            actions={!editing ? <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit user</Button> : undefined}
          />
          <SidePeekDrawerBody>
            <div className="mb-8 flex items-center gap-5">
              <Avatar name={person.name} size={64} decorative className="bg-info text-info-foreground" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SidePeekDrawerTitle>{person.name}</SidePeekDrawerTitle>
                  <ShieldCheck className="size-5 text-primary" aria-label="Verified student" />
                  <span className="text-small text-muted-foreground">she/her</span>
                </div>
                <p className="text-small text-muted-foreground">Member since July 21, 2026</p>
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList aria-label="User sections">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-8">
                <section>
                  <h3 className="mb-2 text-subheading">Details</h3>
                  {editing ? (
                    <div className="space-y-2 border-b border-border-subtle py-3">
                      <Label htmlFor="peek-name">Full name</Label>
                      <Input id="peek-name" value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                  ) : null}
                  <DetailList>
                    <DetailRow label="Email">{person.email}</DetailRow>
                    <DetailRow label="Phone">604-555-0190</DetailRow>
                    <DetailRow label="Membership">{person.membership}</DetailRow>
                    <DetailRow label="User type">Member</DetailRow>
                    <DetailRow label="School">University of British Columbia</DetailRow>
                    <DetailRow label="Area of study">Psychology</DetailRow>
                    <DetailRow label="Student status">Verified</DetailRow>
                    <DetailRow label="Newsletter">Subscribed</DetailRow>
                  </DetailList>
                </section>
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-subheading">Recent transactions</h3>
                    <a href="#transactions" className="inline-flex items-center gap-1 text-small text-info-foreground hover:underline">View all <ExternalLink className="size-3.5" aria-hidden /></a>
                  </div>
                  <div className="space-y-3">
                    <TransactionRow title="2026–27 membership" description="Innovator" amountCents={-1500} date="Sept 27, 2026" media={membershipMedia} />
                    <TransactionRow title="UXathon 2025 · First place" description="Competition award" amountCents={10000} date="Jan 14, 2025" media={awardMedia} />
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 text-subheading">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {["UX/UI design", "Product design", "Interaction design", "Tech"].map((interest) => <span key={interest} className="rounded-full border border-border px-3 py-1 text-small">{interest}</span>)}
                  </div>
                </section>
              </TabsContent>
              <TabsContent value="history"><p className="text-body text-muted-foreground">Activity history will appear here.</p></TabsContent>
            </Tabs>
          </SidePeekDrawerBody>
          {editing ? (
            <SidePeekDrawerFooter>
              <Button variant="secondary" onClick={() => { setName(person.name); setEditing(false); }}>Cancel</Button>
              <Button onClick={() => { setSavedNames((current) => current.map((saved, index) => index === personIndex ? name : saved)); setEditing(false); }}>Save changes</Button>
            </SidePeekDrawerFooter>
          ) : null}
        </SidePeekDrawerContent>
      </SidePeekDrawer>
    </div>
  );
}

const section: GallerySection = {
  id: "side-peek-drawer",
  title: "Side peek drawer",
  group: "Overlays",
  description: "Open a record beside its list to read or edit it without leaving the page.",
  importPath: "@/components/ui/side-peek-drawer",
  importNames: ["SidePeekDrawer", "SidePeekDrawerContent"],
  spec: "§3.15",
  layout: "page",
  openStates: ["drawer", "drawer-edit", "drawer-unsaved"],
  Component: Section,
};

export default section;
