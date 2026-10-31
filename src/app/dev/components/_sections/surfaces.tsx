"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Hourglass,
  Info,
  Pencil,
  Tag,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUSES, StatusBadge, type Status } from "@/components/ui/status-badge";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const TONES = ["success", "warning", "error", "info", "neutral", "tag"] as const;

const ALIASES = [
  { alias: "default", tone: "info" },
  { alias: "secondary", tone: "neutral" },
  { alias: "destructive", tone: "error" },
  { alias: "outline", tone: "tag" },
] as const;

const TONE_ICONS = {
  success: CircleCheck,
  warning: Hourglass,
  error: CircleAlert,
  info: Info,
  neutral: CircleMinus,
  tag: Tag,
} as const;

/** Tones callers still compose by hand (AdminEventsTable, EventTicket); their classes win. */
const CALLER_TONES = [
  { variant: "outline", label: "outline + bg-success", cls: "border-transparent bg-success text-success-foreground" },
  { variant: "secondary", label: "secondary + bg-success", cls: "bg-success text-success-foreground" },
  { variant: "destructive", label: "destructive (Draft)", cls: "" },
  { variant: "outline", label: "outline + info tag", cls: "border-info-foreground bg-info text-info-foreground" },
] as const;

const ROWS: {
  name: string;
  email: string;
  tier: string;
  status: Status;
  paid: string;
  selected?: boolean;
}[] = [
  { name: "Aiko Tanaka", email: "aiko@student.ubc.ca", tier: "Member", status: "going", paid: "$10.00", selected: true },
  { name: "Ben Okafor", email: "ben@student.ubc.ca", tier: "Guest", status: "waitlisted", paid: "$15.00" },
  { name: "Chloe Martin", email: "chloe@student.ubc.ca", tier: "Member", status: "checked_in", paid: "$10.00" },
  { name: "Dev Patel", email: "dev@student.ubc.ca", tier: "", status: "not_selected", paid: "" },
];

const EMPTY = (
  <span aria-label="None" className="text-muted-foreground">
    –
  </span>
);

/** A raw table in a card (§3.6): the table and its pagination share one Card. */
function TableInCard({ density }: { density?: "compact" }) {
  return (
    <div data-density={density}>
      <Card className="gap-0 overflow-hidden rounded-2xl py-0">
        <CardHeader className="border-b py-4 [.border-b]:pb-4">
          <CardTitle>Attendees</CardTitle>
          <CardDescription>UXathon 2026</CardDescription>
          <CardAction>
            <Button variant="secondary" size="sm">
              Export
            </Button>
          </CardAction>
        </CardHeader>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] whitespace-nowrap text-left text-table">
            <thead>
              <tr className="h-(--size-table-row) border-b border-border-subtle text-table-heading text-muted-foreground">
                <th scope="col" className="w-12 pl-6 pr-2 font-medium">
                  <Checkbox aria-label="Select all" />
                </th>
                <th scope="col" className="px-3 font-medium">Name</th>
                <th scope="col" className="px-3 font-medium">Membership</th>
                <th scope="col" className="px-3 font-medium">Status</th>
                <th scope="col" className="px-3 text-right font-medium">Paid</th>
                <th scope="col" className="w-24 pl-3 pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ROWS.map((row) => (
                <tr
                  key={row.email}
                  data-state={row.selected ? "selected" : undefined}
                  className="h-(--size-table-row) data-[state=selected]:bg-muted"
                >
                  <td className="pl-6 pr-2">
                    <Checkbox
                      aria-label={`Select ${row.name}`}
                      defaultChecked={row.selected}
                    />
                  </td>
                  <td className="px-3">
                    {/* Two lines don't fit a 40px compact row, so they share one. */}
                    <div className={density ? "flex items-baseline gap-2" : undefined}>
                      <div className="text-foreground">{row.name}</div>
                      <div className="text-muted-foreground">{row.email}</div>
                    </div>
                  </td>
                  <td className="px-3">{row.tier || EMPTY}</td>
                  <td className="px-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    {row.paid || EMPTY}
                  </td>
                  <td className="pl-3 pr-6 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Edit ${row.name}`}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2 border-t py-3 text-small text-muted-foreground [.border-t]:pt-3">
          <span className="whitespace-nowrap">Showing 1–4 of 48 · Page 1 of 12</span>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" disabled>
              Previous
            </Button>
            <Button variant="secondary" size="sm">
              Next
            </Button>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}

/** Skeleton rows shaped like the table rows above (§3.6: skeleton rows, never a spinner). */
function SkeletonRows() {
  return (
    <Card className="w-full gap-0 py-0">
      <ul className="divide-y divide-border-subtle" aria-busy="true" aria-label="Loading attendees">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex h-(--size-table-row) items-center gap-3 px-6">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="hidden h-3.5 w-16 sm:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-3.5 w-12 sm:block" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Surfaces() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Badge"
        spec="§3.3, §3.15"
        description="One variant prop. Default and large, each with and without a 14px icon."
        min="12rem"
      >
        {TONES.map((tone) => {
          const Icon = TONE_ICONS[tone];
          return (
            <Specimen key={tone} label={tone}>
              <Badge variant={tone}>Label</Badge>
              <Badge variant={tone}>
                <Icon aria-hidden />
                Label
              </Badge>
              <Badge variant={tone} size="large">
                Label
              </Badge>
              <Badge variant={tone} size="large">
                <Icon aria-hidden />
                Label
              </Badge>
            </Specimen>
          );
        })}
      </SpecimenGroup>

      <SpecimenGroup
        title="Badge aliases"
        description="The shadcn names still work and map to a tone, so no call site changes."
        min="12rem"
      >
        {ALIASES.map(({ alias, tone }) => (
          <Specimen key={alias} label={`${alias} = ${tone}`}>
            <Badge variant={alias}>Label</Badge>
            <Badge variant={tone}>Label</Badge>
          </Specimen>
        ))}
        {CALLER_TONES.map(({ variant, label, cls }) => (
          <Specimen key={label} label={`caller: ${label}`}>
            <Badge variant={variant} className={cls}>
              Label
            </Badge>
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="StatusBadge"
        spec="§3.3, §4.3"
        description="The nine statuses: tone, icon and label, default and large."
        min="min(19rem, 100%)"
      >
        {STATUSES.map((status) => (
          <Specimen key={status} label={status}>
            <StatusBadge status={status} />
            <StatusBadge status={status} size="large" />
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Card"
        spec="§3.5"
        description="No shadow, border only. Title is subheading; dividers are border-subtle."
        min="min(22rem, 100%)"
      >
        <Specimen label="Header, action, content, footer" bare>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>UXathon 2026</CardTitle>
              <CardDescription>Nov 14 · Henry Angus 098</CardDescription>
              <CardAction>
                <IconButton label="Edit">
                  <Pencil />
                </IconButton>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-small">
                A 24-hour design sprint with mentors from industry.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>Register</Button>
              <Button variant="outline">Details</Button>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen label="Header and footer dividers (border-b / border-t)" bare>
          <Card className="w-full">
            <CardHeader className="border-b">
              <CardTitle>Order summary</CardTitle>
              <CardDescription>Receipt #1042</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-small">Member ticket × 1 · $10.00</p>
            </CardContent>
            <CardFooter className="border-t">
              <span className="text-small text-muted-foreground">Total $10.00</span>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen label="Title only" bare>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Title only</CardTitle>
            </CardHeader>
          </Card>
        </Specimen>
        <Specimen label="Interactive (caller border/fill change on hover)" bare>
          <Card className="w-full cursor-pointer transition-colors duration-150 hover:border-muted-foreground hover:bg-accent">
            <CardHeader>
              <CardTitle>Hover me</CardTitle>
              <CardDescription>Cards change border and fill, never lift.</CardDescription>
            </CardHeader>
          </Card>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Alert"
        spec="§3.8"
        description="warning, info and destructive, each with a 16px icon and a title."
        min="min(22rem, 100%)"
      >
        <Specimen label="warning" bare>
          <Alert className="w-full" variant="warning" icon={<TriangleAlert />}>
            <AlertTitle>Membership ends Apr 30</AlertTitle>
            <AlertDescription>
              Your membership expires at the end of the term.
            </AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="info" bare>
          <Alert className="w-full" variant="info" icon={<Info />}>
            <AlertTitle>Applications close Nov 1</AlertTitle>
            <AlertDescription>You can edit until then.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="destructive" bare>
          <Alert className="w-full" variant="destructive" icon={<CircleAlert />}>
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>Your card was declined.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="no title (as MembershipCheckout uses it)" bare>
          <Alert className="w-full" variant="info" icon={<Info />}>
            A short notice with an icon and no title.
          </Alert>
        </Specimen>
        <Specimen label="no icon" bare>
          <Alert className="w-full">Draft: only admins can see this.</Alert>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Separator" spec="§2.1" min="14rem">
        <Specimen label="horizontal">
          <Separator />
        </Specimen>
        <Specimen label="vertical">
          <div className="flex h-8 items-center gap-3 text-small">
            Events
            <Separator orientation="vertical" />
            Members
            <Separator orientation="vertical" />
            Settings
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Skeleton"
        spec="§3.6"
        description="Shapes stay with callers; the primitive is a pulsing, aria-hidden block."
        min="16rem"
      >
        <Specimen label="text lines">
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Specimen>
        <Specimen label="avatar + lines">
          <div className="flex w-full items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </Specimen>
        <Specimen label="card">
          <Skeleton className="h-24 w-full rounded-xl" />
        </Specimen>
        <Specimen label="table rows (same row height and columns as the composition below)" bare wide>
          <SkeletonRows />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Table in a card"
        description="A raw table in a Card with its pagination line, in both densities."
      >
        <div className="grid gap-6">
          <Specimen label="Comfortable" bare>
            <div className="w-full">
              <TableInCard />
            </div>
          </Specimen>
          <Specimen label="Compact (data-density)" bare>
            <div className="w-full">
              <TableInCard density="compact" />
            </div>
          </Specimen>
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "surfaces",
  title: "Surfaces",
  spec: "§3.3, §3.5, §3.6, §3.8",
  layout: "split",
  Component: Surfaces,
};

export default section;
