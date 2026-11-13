"use client";

import { useId, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  PanelRight,
  Pencil,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { AppSidebarNav } from "@/components/shared/AppSidebar";
import { CopyCode } from "@/components/shared/CopyCode";
import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import {
  RecordField,
  RecordFrame,
  RecordSection,
  RecordView,
} from "@/components/shared/RecordDrawer";
import { SponsorLogoGrid } from "@/components/shared/SponsorLogoGrid";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SidePeekDrawer,
  SidePeekDrawerBody,
  SidePeekDrawerContent,
  SidePeekDrawerHeader,
  SidePeekDrawerTitle,
} from "@/components/ui/side-peek-drawer";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EventActionsMenu } from "@/app/dev/components/_demos/_fixtures/event-actions-menu";

import { PEOPLE, SPONSORS } from "../_fixtures";
import { LIFT, Panel } from "./frame";
import type { Components } from "./types";

/**
 * The sidebar positions itself with `position: fixed`; the transform makes
 * the frame its containing block, so it sits inside the card.
 */
function AdminShell() {
  return (
    <div
      className={`relative h-[480px] overflow-hidden rounded-xl border border-border-subtle bg-background [transform:translateZ(0)] [&_[data-slot=sidebar-container]]:h-full! [&_[data-slot=sidebar-wrapper]]:h-full [&_[data-slot=sidebar-wrapper]]:min-h-0! ${LIFT}`}
    >
      <SidebarProvider defaultOpen={false}>
        <AppSidebarNav isAdmin isManager pathname="/admin/events" />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h3 className="truncate text-h3">Manage Events</h3>
            </div>
            {[
              ["UXathon 2027", "registration_open"],
              ["Portfolio Night", "full"],
              ["Design Crit Night", "past"],
            ].map(([name, status]) => (
              <div
                key={name}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border-subtle bg-card p-3"
              >
                <span className="truncate text-body-medium">{name}</span>
                <StatusBadge status={status as "full"} />
              </div>
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

function RegistrationWindow() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 10, 9),
    to: new Date(2026, 10, 20),
  });
  const format = (date?: Date) =>
    date?.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) ?? "…";
  return (
    <Panel className="items-center">
      <CardHeader className="w-full">
        <CardTitle>Registration window</CardTitle>
        <CardDescription>
          Opens {format(range?.from)}, closes {format(range?.to)}
        </CardDescription>
      </CardHeader>
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        defaultMonth={new Date(2026, 10, 1)}
      />
    </Panel>
  );
}

function Sponsors() {
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Sponsors</CardTitle>
        <CardDescription>Displaying 6 sponsors</CardDescription>
      </CardHeader>
      <CardContent>
        <SponsorLogoGrid
          sponsors={SPONSORS}
          // Two columns: the card is phone-width on a desktop viewport.
          className="gap-3 min-[600px]:grid-cols-2 lg:grid-cols-2 [&_a]:h-20"
        />
      </CardContent>
    </Panel>
  );
}

const AGENDA = {
  sat: [
    ["9:00 AM", "Check-in and breakfast", "Atrium"],
    ["10:00 AM", "Kickoff and brief", "Great Hall"],
    ["11:30 AM", "Team formation", "Rooms 200–204"],
    ["6:00 PM", "Studio time", "Rooms 200–204"],
  ],
  sun: [
    ["9:00 AM", "Final build", "Rooms 200–204"],
    ["2:00 PM", "Judging", "Great Hall"],
    ["5:00 PM", "Awards and closing", "Great Hall"],
  ],
} as const;

function Agenda() {
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Agenda</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sat" className="gap-4">
          <TabsList aria-label="Agenda days">
            <TabsTrigger value="sat">Sat, Jan 9</TabsTrigger>
            <TabsTrigger value="sun">Sun, Jan 10</TabsTrigger>
          </TabsList>
          {(Object.keys(AGENDA) as (keyof typeof AGENDA)[]).map((day) => (
            <TabsContent key={day} value={day}>
              <ol className="flex flex-col">
                {AGENDA[day].map(([time, session, where], index) => (
                  <li key={session} className="flex flex-col">
                    {index > 0 ? <Separator className="my-3 bg-border-subtle" /> : null}
                    <div className="grid grid-cols-[4.5rem_1fr] gap-3">
                      <span className="text-small tabular-nums text-muted-foreground">{time}</span>
                      <span className="flex flex-col">
                        <span className="text-small font-medium">{session}</span>
                        <span className="text-label font-normal text-muted-foreground">{where}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Panel>
  );
}

function Profile() {
  return (
    <Panel>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar name="Mia Tanaka" src="/people/Mia.png" size={56} />
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-subheading">Mia Tanaka</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Verified student"
                    className="rounded-full text-primary focus-visible:focus-ring"
                  >
                    <ShieldCheck aria-hidden className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Verified UBC student</TooltipContent>
              </Tooltip>
            </div>
            <span className="truncate text-small text-muted-foreground">she/her · Member since 2025</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="success">Innovator</Badge>
          <Badge variant="info">Executive</Badge>
          <Badge variant="tag">Cognitive Systems</Badge>
          <Badge variant="tag">3rd year</Badge>
        </div>
        <Separator className="bg-border-subtle" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-small font-medium">Team Pixel</span>
            <span className="text-label font-normal text-muted-foreground">
              {PEOPLE.length} members
            </span>
          </div>
          <AvatarGroup people={PEOPLE} max={4} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1">
            <Mail aria-hidden />
            Message
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton label="Edit profile">
                <Pencil />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>Edit profile</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Panel>
  );
}

function ActionRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex w-full items-center gap-3">
      {icon}
      <span className="flex-1 text-left">{children}</span>
      <ChevronRight aria-hidden className="text-muted-foreground" />
    </span>
  );
}

function EditDetails() {
  const uid = useId();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-3">
          <ActionRow icon={<Pencil aria-hidden />}>Edit details</ActionRow>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit event details</DialogTitle>
          <DialogDescription>
            Changes are visible to students as soon as you save.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`${uid}-name`}>Event name</FieldLabel>
          <Input id={`${uid}-name`} defaultValue="UXathon 2027" />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save changes</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-3">
          <ActionRow icon={<SlidersHorizontal aria-hidden />}>Filter attendees</ActionRow>
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filter attendees</SheetTitle>
          <SheetDescription>Narrow the list for UXathon 2027.</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <FilterChipGroup aria-label="Membership">
            <FilterChip defaultPressed>Innovator</FilterChip>
            <FilterChip>Explorer</FilterChip>
            <FilterChip>None</FilterChip>
          </FilterChipGroup>
        </div>
        <SheetFooter>
          <Button>Show 96 attendees</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AttendeePeek() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start px-3"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <ActionRow icon={<PanelRight aria-hidden />}>Open Priya Raman</ActionRow>
      </Button>
      <SidePeekDrawer open={open} onOpenChange={setOpen}>
        <SidePeekDrawerContent aria-describedby={undefined}>
          <SidePeekDrawerHeader />
          <SidePeekDrawerBody>
            <div className="mb-6 flex items-center gap-4">
              <Avatar name="Priya Raman" size={56} decorative />
              <div className="flex flex-col gap-1">
                <SidePeekDrawerTitle>Priya Raman</SidePeekDrawerTitle>
                <StatusBadge status="checked_in" />
              </div>
            </div>
            <DetailList>
              <DetailRow label="Email">priya.raman@student.ubc.ca</DetailRow>
              <DetailRow label="Membership">Innovator</DetailRow>
              <DetailRow label="Area of study">Psychology</DetailRow>
              <DetailRow label="Dietary needs" />
            </DetailList>
          </SidePeekDrawerBody>
        </SidePeekDrawerContent>
      </SidePeekDrawer>
    </>
  );
}

/** An event record as the Manage Events drawer shows it. */
function EventRecordPeek() {
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start px-3"
        aria-expanded={open}
        onClick={() => {
          if (!open) setSession((current) => current + 1);
          setOpen(true);
        }}
      >
        <ActionRow icon={<CalendarDays aria-hidden />}>Open event overview</ActionRow>
      </Button>
      <RecordFrame listHref="/dev/gallery" open={open} onClose={() => setOpen(false)}>
        <RecordView
          key={session}
          title="UXathon 2027"
          subtitle="Saturday, January 16, 2027 · 9:00 AM"
          status={<StatusBadge status="registration_open" />}
          details={
            <>
              <RecordSection title="Venue">
                <RecordField label="Location" value="AMS Nest, Room 2306" />
                <RecordField label="Capacity" value="150" />
              </RecordSection>
              <RecordSection title="Tickets">
                <RecordField label="Members" value="Free" />
                <RecordField label="Non-members" value="$10.00" />
                <RecordField label="Applications" value="Required" />
              </RecordSection>
            </>
          }
        />
      </RecordFrame>
    </>
  );
}

function SharePopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-3">
          <ActionRow icon={<Share2 aria-hidden />}>Share registration link</ActionRow>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex flex-col gap-3">
        <PopoverHeader>
          <PopoverTitle>Registration link</PopoverTitle>
          <PopoverDescription>Anyone with the link can register.</PopoverDescription>
        </PopoverHeader>
        <CopyCode code="ubcuxhub.ca/e/uxathon" label="Copy the registration link" />
      </PopoverContent>
    </Popover>
  );
}

function EventActions() {
  return (
    <Panel>
      <CardHeader>
        <CardTitle>UXathon 2027</CardTitle>
        <CardDescription>128 registered · 12 applications to review</CardDescription>
        <CardAction>
          <EventActionsMenu />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col px-3">
        <EditDetails />
        <FilterSheet />
        <AttendeePeek />
        <EventRecordPeek />
        <SharePopover />
      </CardContent>
    </Panel>
  );
}

export const NAVIGATION_COMPONENTS = {
  "admin-shell": AdminShell,
  "event-actions": EventActions,
  "registration-window": RegistrationWindow,
  "profile": Profile,
  "agenda": Agenda,
  "sponsors": Sponsors,
} satisfies Components;
