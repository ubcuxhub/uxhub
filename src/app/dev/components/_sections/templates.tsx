"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  QrCode,
} from "lucide-react";

import { EventCard, EventCardDates } from "@/components/shared/EventCard";
import { Hubbo, type HubboEmotion } from "@/components/shared/Hubbo";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { ListCard, ListRow } from "@/components/shared/ListRow";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  SectionNavigator,
  type NavigatorSection,
} from "@/components/shared/SectionNavigator";
import { SponsorLogoGrid } from "@/components/shared/SponsorLogoGrid";
import { Ticket } from "@/components/shared/Ticket";
import { ActionBanner } from "@/components/ui/action-banner";
import { AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColourPicker } from "@/components/ui/colour-picker";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import {
  SearchableDropdown,
  type SearchableOption,
} from "@/components/ui/searchable-dropdown";
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabNav, TabNavLink } from "@/components/ui/tab-nav";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentSection } from "@/hooks/use-current-section";
import {
  groupEventsByMonth,
  normalizeString,
} from "@/features/events/lib/event-timeline";
import {
  datetimeLocalToTimestamptz,
  formatEventDateLabel,
  formatEventDateTimeLines,
} from "@/lib/date";
import type { IsoDate, WallTime } from "@/lib/date-input";
import type { EventRow } from "@/lib/supabase/models";
import { cn } from "@/lib/utils";

import { Composition } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const TEMPLATES = [
  { id: "events", title: "Events", spec: "§4.4b" },
  { id: "event-detail", title: "Event detail", spec: "§4.4c" },
  { id: "event-builder", title: "Event builder", spec: "§4.4e" },
] as const;
type TemplateId = (typeof TEMPLATES)[number]["id"];

const OPEN_STATES = TEMPLATES.map((template) => template.id);
const FRAME_SUFFIX = "-frame";
const HREF = "/dev/components?section=templates";

// --- Fixtures -------------------------------------------------------------

const art = (from: string, to: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23${from}'/%3E%3Cstop offset='1' stop-color='%23${to}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' fill='url%28%23g%29'/%3E%3Ccircle cx='118' cy='46' r='26' fill='white' fill-opacity='.25'/%3E%3C/svg%3E`;
const ART_A = art("3A5FC4", "B67FC6");
const ART_B = art("325DC4", "7C9CE3");

function event(
  slug: string,
  name: string,
  venue: string,
  starts: string,
  ends: string,
  image: string | null = null,
): EventRow {
  return {
    id: slug,
    slug,
    name,
    location_building: venue,
    location_room: null,
    starts_at: datetimeLocalToTimestamptz(starts),
    ends_at: datetimeLocalToTimestamptz(ends),
    image_url: image,
  } as EventRow;
}

const UPCOMING: EventRow[] = [
  event("uxathon", "UXathon", "UBC Henry Angus (ANGU)", "2027-01-09T09:00", "2027-01-10T15:00", ART_A),
  event("ux-conference", "UX Conference", "UBC Nest Great Hall", "2027-01-11T09:00", "2027-01-11T19:00"),
  event("figma-workshop", "Intro to Figma Workshop", "UBC Hennings 200", "2027-01-25T17:30", "2027-01-25T19:30"),
  event("portfolio-night", "Portfolio Night", "UBC Nest Room 3300", "2027-01-30T18:00", "2027-02-02T21:00", ART_B),
  event("research-101", "User Research 101", "UBC Hennings 202", "2027-02-04T17:30", "2027-02-04T19:00"),
  event("spring-mixer", "Spring Industry Mixer", "UBC Robson Square", "2027-02-18T17:00", "2027-02-18T20:00"),
  event("design-systems", "Design Systems Panel", "UBC Nest Great Hall", "2027-03-03T18:00", "2027-03-03T20:00", ART_B),
  event("case-study-clinic", "Case Study Clinic", "UBC Hennings 200", "2027-03-11T17:30", "2027-03-11T19:30"),
  event("year-end-showcase", "Year-End Showcase", "UBC Nest Great Hall", "2027-04-02T17:00", "2027-04-02T21:00", ART_A),
];
const PAST: EventRow[] = [
  event("design-crit", "Design Crit Night", "UBC Hennings 200", "2026-10-06T18:00", "2026-10-06T20:00"),
  event("fall-kickoff", "Fall Kickoff", "UBC Nest Great Hall", "2026-09-15T17:00", "2026-09-15T20:00", ART_A),
];
const MEMBER_STATUS: Record<string, Status> = {
  uxathon: "registration_open",
  "ux-conference": "waitlisted",
  "figma-workshop": "going",
};

const PEOPLE = [
  { name: "Alex Chen", src: "/people/david.jpg" },
  { name: "Priya Patel" },
  { name: "Jordan Lee", src: "/people/elaine.jpg" },
  { name: "Sam Rivera" },
  { name: "Mia Tanaka", src: "/people/Mia.png" },
  { name: "Ravi Singh" },
] as const;

const SPONSORS = [
  { name: "Google Cloud", href: "https://cloud.google.com", logoSrc: "/sponsor-logos/googlecloud.png" },
  { name: "Microsoft", href: "https://microsoft.com", logoSrc: "/sponsor-logos/microsoft.png" },
  { name: "Notion", href: "https://notion.so", logoSrc: "/sponsor-logos/notion.png" },
  { name: "Red Bull", href: "https://redbull.com", logoSrc: "/sponsor-logos/redbull.png" },
  { name: "TD", href: "https://td.com", logoSrc: "/sponsor-logos/td.png" },
] as const;

const AGENDA = {
  "week-1": [
    ["9:00 AM", "Check-in and breakfast", "Atrium"],
    ["10:00 AM", "Kickoff and brief", "Great Hall"],
    ["11:30 AM", "Team formation", "Rooms 200–204"],
    ["6:00 PM", "Studio time", "Rooms 200–204"],
  ],
  "week-2": [
    ["5:30 PM", "Research share-out", "Room 202"],
    ["6:30 PM", "Mentor office hours", "Great Hall"],
  ],
  "week-3": [
    ["9:00 AM", "Final build", "Rooms 200–204"],
    ["2:00 PM", "Judging", "Great Hall"],
    ["5:00 PM", "Awards and closing", "Great Hall"],
  ],
} as const;

const VENUES: readonly SearchableOption[] = [
  { value: "angu", label: "UBC Henry Angus (ANGU)", description: "2053 Main Mall" },
  { value: "nest", label: "UBC Nest Great Hall", description: "6133 University Blvd" },
  { value: "hennings", label: "UBC Hennings 200", description: "6224 Agricultural Rd" },
  { value: "robson", label: "UBC Robson Square", description: "800 Robson St" },
];
const JUDGES: readonly SearchableOption[] = [
  { value: "alex", label: "Alex Chen", description: "Senior product designer · Acme" },
  { value: "priya", label: "Priya Patel", description: "Design director · Northwind" },
  { value: "jordan", label: "Jordan Lee", description: "Research lead · Contoso" },
  { value: "sam", label: "Sam Rivera", description: "Design engineer · Fernleaf" },
];

// --- Shared pieces --------------------------------------------------------

/**
 * EmptyState's media slot is a 40px disc, so Hubbo sits above it at card size
 * until the component grows a slot for the art.
 */
function HubboEmptyState({
  emotion,
  className,
  ...props
}: { emotion: HubboEmotion; className?: string } & Omit<
  React.ComponentProps<typeof EmptyState>,
  "size" | "media"
>) {
  return (
    <div className={cn("flex flex-col items-center pt-6", className)}>
      <Hubbo emotion={emotion} size="card" />
      <EmptyState size="card" className="pt-3" {...props} />
    </div>
  );
}

const h1 = "text-h1";

// --- Events (§4.4b) -------------------------------------------------------

/**
 * The target arrangement for the portal events page. `EventTimeline` still
 * brings its own search box and "Show Past Events" switch, so this lays the
 * same rail out under SearchField and SegmentedToggle instead.
 */
function EventsTemplate() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("upcoming");
  const source = tab === "past" ? PAST : UPCOMING;
  const needle = normalizeString(query);
  const shown = needle
    ? source.filter((item) =>
        normalizeString(`${item.name} ${item.location_building ?? ""}`).includes(
          needle,
        ),
      )
    : source;
  const groups = groupEventsByMonth(shown);

  return (
    <PageContainer className="flex flex-col gap-8">
      <ActionBanner
        title="You’re accepted to UXathon."
        action={<Button size="sm">Confirm spot</Button>}
      >
        Confirm your spot by Nov 14.
      </ActionBanner>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className={h1}>
          {tab === "past"
            ? `${PAST.length} past events`
            : `${UPCOMING.length} upcoming events`}
        </h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            label="Search events"
            placeholder="Search events"
            value={query}
            onValueChange={setQuery}
            resultCount={shown.length}
            className="sm:w-64"
          />
          <SegmentedToggle
            aria-label="Show events"
            value={tab}
            onValueChange={setTab}
            className="w-full sm:w-auto"
          >
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
          </SegmentedToggle>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <HubboEmptyState
            emotion="curious"
            title={`No events match “${query}”`}
            description="Check the spelling, or try a venue or a month."
            actions={
              <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`${group.key}-heading`}>
              <h2 id={`${group.key}-heading`} className="mb-4 text-h2">
                {group.label}
              </h2>
              <ol>
                {group.events.map((item, index) => (
                  <TimelineRow
                    key={item.id}
                    event={item}
                    status={
                      tab === "past" ? "past" : (MEMBER_STATUS[item.id] ?? null)
                    }
                    isLast={index === group.events.length - 1}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function TimelineRow({
  event: item,
  status,
  isLast,
}: {
  event: EventRow;
  status: Status | null;
  isLast: boolean;
}) {
  return (
    <li className="grid gap-y-2 pb-6 sm:grid-cols-[7.5rem_1.5rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0">
      <p className="text-body font-medium text-foreground sm:pt-1 sm:font-normal">
        {formatEventDateLabel(item.starts_at, item.ends_at)}
      </p>
      <div aria-hidden className="relative hidden sm:block">
        <div
          className={cn(
            "absolute top-2 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-border",
            isLast ? "bottom-0" : "-bottom-6",
          )}
        />
        <div className="absolute top-1 left-2 size-2 rounded-full bg-muted-foreground" />
      </div>
      <EventCard
        title={item.name}
        href={HREF}
        venue={item.location_building}
        when={
          <EventCardDates
            lines={formatEventDateTimeLines(item.starts_at, item.ends_at)}
          />
        }
        status={status}
        image={item.image_url ? { src: item.image_url } : null}
      />
    </li>
  );
}

/** §4.4f: say what goes here and what to do next; Hubbo at card size. */
function EmptyVariants() {
  return (
    <Composition
      title="Empty and error states (§4.4f)"
      description="One Hubbo per screen, so these are separate screens. Resting for nothing yet, curious for a search with no match, thinking for a failed load."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["resting", "No upcoming events", "We’re planning the next one. Check back soon.", "View past events"],
            ["curious", "No events match “portfolo”", "Check the spelling, or try a venue or a month.", "Clear search"],
            ["thinking", "Couldn’t load events", "Something went wrong on our side. Your other pages still work.", "Try again"],
          ] as const
        ).map(([emotion, title, description, action]) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card"
          >
            <HubboEmptyState
              emotion={emotion}
              title={title}
              description={description}
              actions={
                <Button size="sm" variant="secondary">
                  {action}
                </Button>
              }
            />
          </div>
        ))}
      </div>
    </Composition>
  );
}

// --- Event detail (§4.4c) -------------------------------------------------

function MetaLine({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-body text-muted-foreground">
      <Icon aria-hidden className="mt-1 size-4 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function DetailTemplate() {
  return (
    <PageContainer backHref={HREF} backLabel="Back to Events" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className={h1}>Design Sprint</h1>
          <StatusBadge status="going" />
        </div>
        <ul className="flex flex-col gap-2">
          <MetaLine icon={CalendarDays}>Sat, Jan 9 – Sun, Jan 10</MetaLine>
          <MetaLine icon={Clock}>9:00 AM–7:00 PM · 9:00 AM–3:00 PM</MetaLine>
          <MetaLine icon={MapPin}>UBC Henry Angus (ANGU), 2053 Main Mall</MetaLine>
        </ul>
        <div className="flex items-center gap-3 text-small text-muted-foreground">
          <AvatarGroup people={PEOPLE} max={4} />
          128 going
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-body">
            <p>
              Two days to take a real brief from research to a clickable
              prototype, with mentors in the room and judges at the end.
            </p>
            <Button variant="link" asChild className="w-fit">
              <a href="https://ubcuxhub.ca">
                Event website
                <ExternalLink aria-hidden />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registration</CardTitle>
            <CardDescription>You’re registered. Show your ticket at the door.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Ticket
              eventName="Design Sprint"
              holderName="John Doe"
              code={<QrCode aria-hidden className="size-8" strokeWidth={1.5} />}
              action={
                <Button variant="secondary" size="sm">
                  View ticket
                </Button>
              }
            />
            <Button variant="link" asChild className="w-fit">
              <a href="https://ubcuxhub.ca">
                <FileText aria-hidden />
                Participant package
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your team</CardTitle>
          <CardDescription>0/4 members</CardDescription>
        </CardHeader>
        <CardContent>
          <HubboEmptyState
            emotion="welcoming"
            className="pt-0"
            title="You’re not on a team yet"
            description="Join a team that has room, or start your own and invite up to three people."
            actions={
              <>
                <Button size="sm">Join a team</Button>
                <Button size="sm" variant="secondary">
                  Create team
                </Button>
              </>
            }
          />
        </CardContent>
      </Card>

      <section aria-labelledby="template-agenda" className="flex flex-col gap-4">
        <h2 id="template-agenda" className="text-h2">
          Agenda
        </h2>
        <Tabs defaultValue="week-1" className="gap-4">
          <TabsList aria-label="Agenda weeks">
            <TabsTrigger value="week-1">Week 1</TabsTrigger>
            <TabsTrigger value="week-2">Week 2</TabsTrigger>
            <TabsTrigger value="week-3">Week 3</TabsTrigger>
          </TabsList>
          {(Object.keys(AGENDA) as (keyof typeof AGENDA)[]).map((week) => (
            <TabsContent key={week} value={week}>
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Where</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AGENDA[week].map(([time, session, where]) => (
                      <TableRow key={`${time}-${session}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {time}
                        </TableCell>
                        <TableCell>{session}</TableCell>
                        <TableCell className="text-muted-foreground">{where}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <ListCard title="Judges" summary="Displaying 3 judges">
        <ListRow
          name="Alex Chen"
          description="Senior product designer · Acme"
          lead={{ kind: "person", src: "/people/david.jpg" }}
          link={{ href: "https://linkedin.com", label: "LinkedIn" }}
        />
        <ListRow
          name="Priya Patel"
          description="Design director · Northwind"
          lead={{ kind: "person" }}
        />
        <ListRow
          name="Jordan Lee"
          description="Research lead · Contoso"
          lead={{ kind: "person", src: "/people/elaine.jpg" }}
        />
      </ListCard>

      {/* ListCard's body is a <ul>, so the logo grid gets the same chrome by hand. */}
      <section
        aria-labelledby="template-sponsors"
        className="flex flex-col gap-6 rounded-xl border border-border bg-card py-6"
      >
        <header className="flex flex-col gap-1.5 px-4 sm:px-6">
          <h3 id="template-sponsors" className="text-subheading">
            Sponsors
          </h3>
          <p className="text-small text-muted-foreground">Displaying 5 sponsors</p>
        </header>
        <div aria-hidden className="h-px bg-border-subtle" />
        <div className="px-4 sm:px-6">
          <SponsorLogoGrid sponsors={SPONSORS} />
        </div>
      </section>
    </PageContainer>
  );
}

/** The admin view of the same page: TabNav replaces the student's single column. */
function AdminHeader() {
  const base = "/admin/events/design-sprint";
  return (
    <Composition
      title="Event detail, admin view (TabNav)"
      description="The page header for the admin event pages. TabNav is pinned to Overview here, since the gallery isn't on that route."
    >
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
        <PageContainer
          backHref={HREF}
          backLabel="Back to Manage Events"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className={h1}>Design Sprint</h1>
            <Badge variant="neutral">Draft</Badge>
          </div>
          <TabNav aria-label="Event pages" pathname={base}>
            <TabNavLink href={base} exact>Overview</TabNavLink>
            <TabNavLink href={`${base}/review-applications`} count={12}>
              Applications
            </TabNavLink>
            <TabNavLink href={`${base}/check-in`}>Check-in</TabNavLink>
          </TabNav>
        </PageContainer>
      </div>
    </Composition>
  );
}

// --- Event builder (§4.4e) ------------------------------------------------

const TODAY: IsoDate = "2026-11-04";

const SECTION_IDS = [
  ["builder-basics", "Basics"],
  ["builder-description", "Description"],
  ["builder-date", "Date and location"],
  ["builder-people", "People"],
] as const;

function BuilderSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-6 flex-col gap-6 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-label tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}/{String(SECTION_IDS.length).padStart(2, "0")}
        </span>
        <h2 id={`${id}-heading`} className="text-h2">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function BuilderTemplate() {
  const ids = {
    name: useId(),
    description: useId(),
    date: useId(),
    start: useId(),
    end: useId(),
  };
  const [name, setName] = useState("Design Sprint");
  const [thumbnail, setThumbnail] = useState(ART_A);
  const [header, setHeader] = useState("");
  const [colour, setColour] = useState("#325DC4");
  const [customColours, setCustomColours] = useState<string[]>([]);
  const [date, setDate] = useState<IsoDate | null>("2026-11-14");
  const [start, setStart] = useState<WallTime | null>("09:00");
  const [end, setEnd] = useState<WallTime | null>("08:30");
  const [endError, setEndError] = useState<string | null>(null);
  const [venue, setVenue] = useState<string | null>("angu");
  const [judges, setJudges] = useState<string[]>(["alex"]);
  const currentId = useCurrentSection(SECTION_IDS.map(([id]) => id));

  const sections: NavigatorSection[] = [
    { id: "builder-basics", title: "Basics", state: name.trim() ? "complete" : "attention", issues: name.trim() ? undefined : 1, required: true },
    { id: "builder-description", title: "Description", state: "not-started", required: true },
    { id: "builder-date", title: "Date and location", state: endError ? "attention" : "complete", issues: endError ? 1 : undefined, required: true },
    { id: "builder-people", title: "People", state: "optional", required: false },
  ];

  return (
    <PageContainer
      backHref={HREF}
      backLabel="Back to Manage Events"
      className="flex flex-col gap-8 pb-28"
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className={h1}>{name.trim() || "Untitled event"}</h1>
            <Badge variant="neutral">Draft</Badge>
          </div>
          <p className="text-small text-muted-foreground">Saved 2 minutes ago</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">Preview</Button>
          <Button variant="secondary">Save draft</Button>
          <Button>Publish</Button>
        </div>
      </header>

      <BuilderSection id="builder-basics" index={0} title="Basics">
        <Field data-invalid={name.trim() ? undefined : true}>
          <FieldLabel htmlFor={ids.name}>Event name</FieldLabel>
          <Input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={name.trim() ? undefined : true}
            aria-describedby={name.trim() ? undefined : `${ids.name}-error`}
          />
          {name.trim() ? null : (
            <FieldError id={`${ids.name}-error`}>Give the event a name.</FieldError>
          )}
        </Field>
        <div className="grid gap-6 md:grid-cols-2">
          <ImageUpload
            label="Thumbnail"
            requirements={{ square: true, minWidth: 600, minHeight: 600 }}
            value={thumbnail}
            onChange={setThumbnail}
          />
          <ImageUpload
            label="Page header image"
            requirements={{ minWidth: 1600, minHeight: 400 }}
            value={header}
            onChange={setHeader}
          />
        </div>
        <ColourPicker
          label="Event colour"
          value={colour}
          onValueChange={setColour}
          customColours={customColours}
          onCustomColoursChange={setCustomColours}
        />
        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-label text-muted-foreground">Featured card preview</span>
            <EventCard
              title={name.trim() || "Untitled event"}
              href={HREF}
              venue="UBC Henry Angus (ANGU)"
              when={<EventCardDates lines={[{ day: "Sat, Nov 14", time: "9:00 AM–5:00 PM" }]} />}
              status="registration_open"
              image={thumbnail ? { src: thumbnail } : null}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label text-muted-foreground">Ticket preview</span>
            <Ticket
              eventName={name.trim() || "Untitled event"}
              holderName="John Doe"
              eventColour={colour}
              code={<QrCode aria-hidden className="size-8" strokeWidth={1.5} />}
            />
          </div>
        </div>
      </BuilderSection>

      <BuilderSection id="builder-description" index={1} title="Description">
        <Field>
          <FieldLabel htmlFor={ids.description}>About the event</FieldLabel>
          <Textarea
            id={ids.description}
            rows={4}
            maxLength={500}
            showCount
            placeholder="What happens, who it is for, what to bring."
          />
        </Field>
      </BuilderSection>

      <BuilderSection id="builder-date" index={2} title="Date and location">
        <div className="grid items-start gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field>
            <FieldLabel htmlFor={ids.date}>Date</FieldLabel>
            <DateField
              id={ids.date}
              value={date}
              onValueChange={setDate}
              today={TODAY}
              min={TODAY}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.start}>Start time</FieldLabel>
            <TimeField id={ids.start} value={start} onValueChange={setStart} />
          </Field>
          <Field data-invalid={endError ? true : undefined}>
            <FieldLabel htmlFor={ids.end}>End time</FieldLabel>
            <TimeField
              id={ids.end}
              value={end}
              onValueChange={setEnd}
              onValidityChange={setEndError}
              after={start ?? undefined}
              aria-describedby={endError ? `${ids.end}-error` : undefined}
            />
            {endError ? <FieldError id={`${ids.end}-error`}>{endError}</FieldError> : null}
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-body-medium text-foreground">Venue</span>
          <SearchableDropdown
            options={VENUES}
            value={venue}
            onValueChange={setVenue}
            placeholder="Search venues"
            aria-label="Venue"
          />
        </div>
      </BuilderSection>

      <BuilderSection id="builder-people" index={3} title="People">
        <div className="flex flex-col gap-2">
          <span className="text-body-medium text-foreground">Judges</span>
          <SearchableDropdown
            options={JUDGES}
            multiple
            value={judges}
            onValueChange={setJudges}
            placeholder="Search members"
            addPlaceholder="Add a judge"
            aria-label="Judges"
          />
        </div>
      </BuilderSection>

      <SectionNavigator
        title="Event setup"
        sections={sections}
        currentId={currentId}
      />
    </PageContainer>
  );
}

// --- Gallery frames -------------------------------------------------------

function TemplateBody({ id }: { id: TemplateId }) {
  if (id === "event-detail") return <DetailTemplate />;
  if (id === "event-builder") return <BuilderTemplate />;
  return <EventsTemplate />;
}

/** The theme the gallery put on the page, so the mobile frame matches it. */
function usePageTheme() {
  return useSyncExternalStore(
    () => () => {},
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}

/**
 * Tailwind's breakpoints follow the viewport, not a container, so a narrow div
 * would still lay out as desktop. The mobile frame is the gallery in an iframe
 * that renders the template alone (`-frame`), which does get a 375px viewport.
 */
function MobileFrame({ id }: { id: TemplateId }) {
  const theme = usePageTheme();
  return (
    <iframe
      title={`${id} template at 375px`}
      src={`/dev/components?section=templates&open=${id}${FRAME_SUFFIX}&theme=${theme}`}
      loading="lazy"
      className="h-[760px] w-[375px] max-w-full rounded-xl border border-border bg-background"
    />
  );
}

function Section({ open }: SectionProps) {
  const framed = open?.endsWith(FRAME_SUFFIX) ?? false;
  const requested = framed ? open!.slice(0, -FRAME_SUFFIX.length) : open;
  const template =
    TEMPLATES.find((item) => item.id === requested) ?? TEMPLATES[0];

  if (framed) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <TemplateBody id={template.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Composition
        title={`${template.title} (${template.spec}), desktop`}
        description={`Built from the real components on fixture data: no fetching, no auth. Pick another template with the Open links in the toolbar. Laid out at the width of your window; the page container caps at 1152px.${template.id === "event-builder" ? " The section pill floats at the bottom of the window, as it does on the real page." : ""}`}
      >
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
          <TemplateBody id={template.id} />
        </div>
      </Composition>

      <Composition
        title={`${template.title}, mobile (375px)`}
        description="The same template in an iframe, so its breakpoints see a phone-width viewport. Interactive, and scrolls on its own."
      >
        <MobileFrame id={template.id} />
      </Composition>

      {template.id === "events" ? <EmptyVariants /> : null}
      {template.id === "event-detail" ? <AdminHeader /> : null}
    </div>
  );
}

const section: GallerySection = {
  id: "templates",
  title: "Templates",
  spec: "§4.4",
  layout: "page",
  openStates: OPEN_STATES,
  Component: Section,
};

export default section;
