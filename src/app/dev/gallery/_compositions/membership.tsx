"use client";

import { useId, useState } from "react";
import { ArrowRight, Coffee, PenTool, Printer } from "lucide-react";

import { CopyCode } from "@/components/shared/CopyCode";
import { Ticket } from "@/components/shared/Ticket";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { ActionBanner } from "@/components/ui/action-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { MembershipCard } from "@/features/memberships/components/MembershipCard";
import { SettingsRow } from "@/features/settings/components/SettingsRow";

import { QR_TOKEN } from "../_fixtures";
import { Panel } from "./frame";
import { QrCode } from "./qr";
import type { Components } from "./types";

function Membership() {
  return (
    <MembershipCard
      cardholder="Alex Chen"
      expiresAt="2027-04-30T23:59:00-07:00"
      membershipType={{
        name: "innovator",
        description:
          "Member pricing on every event, early registration for UXathon, and a seat at portfolio reviews.",
      }}
    />
  );
}

const PLANS = [
  { value: "explorer", title: "Explorer", note: "Member pricing on events", price: "$10" },
  { value: "innovator", title: "Innovator", note: "Plus early registration and reviews", price: "$15" },
] as const;

function Renewal() {
  const uid = useId();
  const [plan, setPlan] = useState("innovator");
  return (
    <Panel>
      <CardContent className="flex flex-col gap-5">
        <ActionBanner
          title="Your membership ends Apr 30."
          action={<Button size="sm">Renew</Button>}
        >
          Renew now to keep member pricing.
        </ActionBanner>
        <FieldSet>
          <FieldLegend variant="label">Choose a membership for 2027–28</FieldLegend>
          <RadioGroup value={plan} onValueChange={setPlan} className="gap-2">
            {PLANS.map((option) => (
              <FieldLabel key={option.value} htmlFor={`${uid}-${option.value}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>
                      {option.title}
                      {option.value === "innovator" ? (
                        <Badge variant="info">Most picked</Badge>
                      ) : null}
                    </FieldTitle>
                    <FieldDescription>
                      {option.price} a year · {option.note}
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={option.value} id={`${uid}-${option.value}`} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>
        <Button className="w-full">
          Continue to checkout
          <ArrowRight aria-hidden />
        </Button>
      </CardContent>
    </Panel>
  );
}

function Tickets() {
  return (
    <div className="flex flex-col gap-3">
      <Ticket
        eventName="UXathon 2027"
        holderName="Alex Chen"
        eventColour="#325DC4"
        code={<QrCode value={QR_TOKEN} />}
      />
      <Ticket
        eventName="Design Crit Night"
        holderName="Alex Chen"
        eventColour="#B67FC6"
        state="used"
        code={<QrCode value={`${QR_TOKEN}-crit`} />}
      />
      <Ticket
        eventName="Portfolio Night"
        holderName="Alex Chen"
        state="pending"
        caption="Confirm by Jan 20"
      />
    </div>
  );
}

const membershipMedia = <div className="size-full bg-ux-hub" />;
const eventMedia = (
  <div className="size-full bg-linear-to-br from-primary to-info" />
);

function PurchaseHistory() {
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Purchase history</CardTitle>
        <CardDescription>Receipts go to alex.chen@student.ubc.ca</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TransactionRow
          title="2026–27 membership"
          description="Innovator"
          amountCents={-1500}
          date="Sept 27, 2026"
          media={membershipMedia}
        />
        <TransactionRow
          title="UXathon 2027"
          description="Member ticket"
          amountCents={-1000}
          date="Nov 2, 2026"
          media={eventMedia}
        />
        <TransactionRow
          title="UXathon 2025 · First place"
          description="Competition award"
          amountCents={10000}
          date="Jan 14, 2025"
          media={membershipMedia}
        />
      </CardContent>
    </Panel>
  );
}

const PERKS = [
  { icon: PenTool, partner: "Figma", perk: "Free Professional plan for a year", code: "FIGMA-UXHUB-27" },
  { icon: Coffee, partner: "Loafe Café", perk: "15% off drinks on campus", code: "LOAFE15" },
  { icon: Printer, partner: "AMS Copy Centre", perk: "Portfolio prints at cost", code: "PRINTUX" },
] as const;

function MemberPerks() {
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Member perks</CardTitle>
        <CardDescription>Codes for Innovator members, valid until Apr 30.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {PERKS.map(({ icon: Icon, partner, perk, code }, index) => (
          <div key={partner} className="flex flex-col gap-3">
            {index > 0 ? <Separator className="my-4 bg-border-subtle" /> : null}
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-body-medium">{partner}</p>
                <p className="text-small text-muted-foreground">{perk}</p>
              </div>
            </div>
            <CopyCode code={code} label={`Copy the ${partner} code`} />
          </div>
        ))}
      </CardContent>
    </Panel>
  );
}

function Settings() {
  const [newsletter, setNewsletter] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [waitlist, setWaitlist] = useState(false);
  const [theme, setTheme] = useState("system");
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        <SettingsRow title="Newsletter" description="The monthly roundup of events and openings.">
          <Switch checked={newsletter} onCheckedChange={setNewsletter} aria-label="Newsletter" />
        </SettingsRow>
        <SettingsRow title="Event reminders" description="An email the day before each event.">
          <Switch checked={reminders} onCheckedChange={setReminders} aria-label="Event reminders" />
        </SettingsRow>
        <SettingsRow title="Waitlist offers" description="A text when a spot opens up.">
          <Switch checked={waitlist} onCheckedChange={setWaitlist} aria-label="Waitlist offers" />
        </SettingsRow>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 border-t [.border-t]:pt-5">
        <span className="text-button">Appearance</span>
        <SegmentedToggle
          aria-label="Appearance"
          value={theme}
          onValueChange={setTheme}
          className="w-full"
        >
          <SegmentedToggleItem value="light">Light</SegmentedToggleItem>
          <SegmentedToggleItem value="dark">Dark</SegmentedToggleItem>
          <SegmentedToggleItem value="system">System</SegmentedToggleItem>
        </SegmentedToggle>
      </CardFooter>
    </Panel>
  );
}

export const MEMBERSHIP_COMPONENTS = {
  "membership-card": Membership,
  "membership-renewal": Renewal,
  "tickets": Tickets,
  "purchase-history": PurchaseHistory,
  "member-perks": MemberPerks,
  "notification-settings": Settings,
} satisfies Components;
