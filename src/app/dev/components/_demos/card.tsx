import { Pencil } from "lucide-react";

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
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge, type Status } from "@/components/ui/status-badge";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

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

function CardDemo() {
  return (
    <div className="flex flex-col gap-8">
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

export default CardDemo;
