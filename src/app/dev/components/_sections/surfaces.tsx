"use client";

import { CircleAlert, Info, Pencil, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const BADGE_VARIANTS = ["default", "secondary", "destructive", "outline"] as const;

/** Tones callers compose by hand today (AdminEventsTable, EventTicket). */
const CALLER_TONES = [
  { label: "success", cls: "border-transparent bg-success-bg text-success" },
  { label: "warning", cls: "border-transparent bg-warning-bg text-warning" },
  { label: "error", cls: "border-transparent bg-error-bg text-error" },
  { label: "info", cls: "border-transparent bg-info-bg text-info" },
];

const ROWS = [
  { name: "Aiko Tanaka", email: "aiko@student.ubc.ca", tier: "Member", status: "Going" },
  { name: "Ben Okafor", email: "ben@student.ubc.ca", tier: "Guest", status: "Waitlisted" },
  { name: "Chloe Martin", email: "chloe@student.ubc.ca", tier: "Member", status: "Draft" },
  { name: "Dev Patel", email: "dev@student.ubc.ca", tier: "", status: "Going" },
];

const STATUS_CLASS: Record<string, string> = {
  Going: "border-transparent bg-success-bg text-success",
  Waitlisted: "border-transparent bg-warning-bg text-warning",
  Draft: "",
};

/** A raw table in a card, as the admin tables are built today. */
function TableInCard({ density }: { density?: "compact" }) {
  return (
    <div data-density={density}>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-subheading">Attendees</CardTitle>
          <CardDescription>UXathon 2026</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-table">
            <thead>
              <tr className="border-b text-table-heading text-fg-secondary">
                <th className="w-12 px-4 py-3">
                  <Checkbox aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Membership</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ROWS.map((row) => (
                <tr key={row.email} className="h-(--size-table-row)">
                  <td className="px-4">
                    <Checkbox aria-label={`Select ${row.name}`} />
                  </td>
                  <td className="px-4">
                    <div>{row.name}</div>
                    <div className="text-fg-secondary">{row.email}</div>
                  </td>
                  <td className="px-4">
                    {row.tier || (
                      <span aria-label="None" className="text-fg-secondary">
                        –
                      </span>
                    )}
                  </td>
                  <td className="px-4">
                    <Badge
                      variant={row.status === "Draft" ? "secondary" : "outline"}
                      className={STATUS_CLASS[row.status]}
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 text-right">
                    <Button variant="outline" size="icon" aria-label={`Edit ${row.name}`}>
                      <Pencil />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardFooter className="justify-between border-t py-3 text-small text-fg-secondary">
          <span>Showing 1–4 of 48 · Page 1 of 12</span>
          <span className="flex gap-2">
            <Button variant="outline" disabled>
              Previous
            </Button>
            <Button variant="outline">Next</Button>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}

function Surfaces() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Badge"
        spec="§3.3, §3.15"
        description="Current variants, with and without an icon."
        min="12rem"
      >
        {BADGE_VARIANTS.map((variant) => (
          <Specimen key={variant} label={variant}>
            <Badge variant={variant}>Label</Badge>
          </Specimen>
        ))}
        {BADGE_VARIANTS.map((variant) => (
          <Specimen key={variant} label={`${variant} / icon`}>
            <Badge variant={variant}>
              <CircleAlert className="mr-1 size-3.5" aria-hidden />
              Label
            </Badge>
          </Specimen>
        ))}
        {CALLER_TONES.map((tone) => (
          <Specimen key={tone.label} label={`caller-composed ${tone.label}`}>
            <Badge variant="outline" className={tone.cls}>
              {tone.label}
            </Badge>
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Card"
        spec="§3.5"
        description="Header with action, description, content and footer, with and without dividers."
        min="22rem"
      >
        <Specimen label="Header, action, content, footer" bare>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>UXathon 2026</CardTitle>
              <CardDescription>Nov 14 · Henry Angus 098</CardDescription>
              <CardAction>
                <Button variant="outline" size="icon" aria-label="Edit">
                  <Pencil />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-small text-muted-foreground">
                A 24-hour design sprint with mentors from industry.
              </p>
            </CardContent>
            <CardFooter className="gap-3">
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
        <Specimen label="Interactive (caller hover classes)" bare>
          <Card className="w-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Hover me</CardTitle>
              <CardDescription>Cards lift on hover today.</CardDescription>
            </CardHeader>
          </Card>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Alert"
        spec="§3.8"
        description="warning, info and destructive, each with an icon and a title."
        min="22rem"
      >
        <Specimen label="warning" bare>
          <Alert variant="warning" icon={<TriangleAlert className="size-4" />}>
            <AlertTitle>Membership ends Apr 30</AlertTitle>
            <AlertDescription>
              Your membership expires at the end of the term.
            </AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="info" bare>
          <Alert variant="info" icon={<Info className="size-4" />}>
            <AlertTitle>Applications close Nov 1</AlertTitle>
            <AlertDescription>You can edit until then.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="destructive" bare>
          <Alert variant="destructive" icon={<CircleAlert className="size-4" />}>
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>Your card was declined.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="no icon, no title" bare>
          <Alert variant="info">A short notice without an icon.</Alert>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Separator" min="14rem">
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
        description="Shapes stay with callers; the primitive is a pulsing block."
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
          <Skeleton className={cn("h-24 w-full rounded-xl")} />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Table in a card"
        description="A raw table in a Card as the admin tables are built today, in both densities."
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
