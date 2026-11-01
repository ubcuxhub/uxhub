"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

function SelectOptions() {
  return (
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Year</SelectLabel>
        <SelectItem value="1">1st year</SelectItem>
        <SelectItem value="2">2nd year</SelectItem>
        <SelectItem value="3">3rd year</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectItem value="4">4th year</SelectItem>
      <SelectItem value="5">5th year or above</SelectItem>
    </SelectContent>
  );
}

/** Checkbox with the `indeterminate` DOM property set, which has no attribute. */
function IndeterminateCheckbox({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = true;
  }, []);
  return <Checkbox ref={ref} aria-label={label} disabled={disabled} />;
}

function FormControls({ open }: SectionProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const today = new Date();
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 10, 10),
    to: new Date(2026, 10, 14),
  });
  const [picked, setPicked] = useState<Date | undefined>(
    new Date(2026, 10, 18),
  );

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Input"
        spec="§3.2"
        description="Default, filled, invalid and disabled. The invalid state is the aria-invalid attribute callers already set."
        min="15rem"
      >
        <Specimen label="empty, placeholder">
          <Input aria-label="Empty" placeholder="Enter your name" />
        </Specimen>
        <Specimen label="filled">
          <Input aria-label="Filled" defaultValue="Johnny Dong" />
        </Specimen>
        <Specimen label="aria-invalid">
          <Input aria-label="Invalid" defaultValue="not-an-email" aria-invalid />
        </Specimen>
        <Specimen label="disabled, empty">
          <Input aria-label="Disabled" placeholder="Enter your name" disabled />
        </Specimen>
        <Specimen label="disabled, filled">
          <Input aria-label="Disabled filled" defaultValue="Johnny Dong" disabled />
        </Specimen>
        <Specimen label="type=email">
          <Input aria-label="Email" type="email" placeholder="you@student.ubc.ca" />
        </Specimen>
        <Specimen label="type=password">
          <Input aria-label="Password" type="password" defaultValue="hunter2hunter2" />
        </Specimen>
        <Specimen label="type=number">
          <Input aria-label="Number" type="number" defaultValue={40} />
        </Specimen>
        <Specimen label="type=file">
          <Input aria-label="File" type="file" />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Textarea" spec="§3.12" min="15rem">
        <Specimen label="empty, placeholder">
          <Textarea aria-label="Empty" placeholder="Tell us about the event" />
        </Specimen>
        <Specimen label="filled">
          <Textarea
            aria-label="Filled"
            defaultValue="A night of design critique, pizza and portfolio feedback from industry mentors."
          />
        </Specimen>
        <Specimen label="aria-invalid">
          <Textarea aria-label="Invalid" defaultValue="Too short" aria-invalid />
        </Specimen>
        <Specimen label="disabled">
          <Textarea aria-label="Disabled" placeholder="Tell us about the event" disabled />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Select"
        spec="§3.2"
        description="Trigger states. The menu opens with ?open=select (checked in light and dark)."
        min="15rem"
      >
        <Specimen label="placeholder">
          <Select>
            <SelectTrigger aria-label="Year (placeholder)">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectOptions />
          </Select>
        </Specimen>
        <Specimen label="with value">
          <Select defaultValue="3">
            <SelectTrigger aria-label="Year (value)">
              <SelectValue />
            </SelectTrigger>
            <SelectOptions />
          </Select>
        </Specimen>
        <Specimen label="aria-invalid">
          <Select>
            <SelectTrigger aria-label="Year (invalid)" aria-invalid>
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectOptions />
          </Select>
        </Specimen>
        <Specimen label="disabled">
          <Select disabled defaultValue="2">
            <SelectTrigger aria-label="Year (disabled)">
              <SelectValue />
            </SelectTrigger>
            <SelectOptions />
          </Select>
        </Specimen>
        <Specimen label="Menu (?open=select)">
          <Select defaultOpen={open === "select"} defaultValue="3">
            <SelectTrigger aria-label="Year (menu)">
              <SelectValue />
            </SelectTrigger>
            <SelectOptions />
          </Select>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Checkbox" spec="§3.2" min="13rem">
        <Specimen label="unchecked">
          <Checkbox aria-label="Unchecked" />
        </Specimen>
        <Specimen label="checked">
          <Checkbox aria-label="Checked" defaultChecked />
        </Specimen>
        <Specimen label="indeterminate">
          <IndeterminateCheckbox label="Indeterminate" />
        </Specimen>
        <Specimen label="disabled">
          <Checkbox aria-label="Disabled" disabled />
        </Specimen>
        <Specimen label="disabled, checked">
          <Checkbox aria-label="Disabled checked" disabled defaultChecked />
        </Specimen>
        <Specimen label="disabled, indeterminate">
          <IndeterminateCheckbox label="Disabled indeterminate" disabled />
        </Specimen>
        <Specimen label="aria-invalid">
          <Checkbox aria-label="Invalid" aria-invalid />
        </Specimen>
        <Specimen label="disabled, with label">
          <Field orientation="horizontal" data-disabled>
            <Checkbox id={id("conduct")} disabled />
            <FieldLabel htmlFor={id("conduct")}>
              Agree to the code of conduct
            </FieldLabel>
          </Field>
        </Specimen>
        <Specimen label="with label and description">
          <Field orientation="horizontal">
            <Checkbox id={id("terms")} defaultChecked />
            <FieldContent>
              <FieldLabel htmlFor={id("terms")}>Email me event updates</FieldLabel>
              <FieldDescription>About events you registered for.</FieldDescription>
            </FieldContent>
          </Field>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Switch" spec="§3.2" min="13rem">
        <Specimen label="off">
          <Switch aria-label="Off" />
        </Specimen>
        <Specimen label="on">
          <Switch aria-label="On" defaultChecked />
        </Specimen>
        <Specimen label="disabled, off">
          <Switch aria-label="Disabled off" disabled />
        </Specimen>
        <Specimen label="disabled, on">
          <Switch aria-label="Disabled on" disabled defaultChecked />
        </Specimen>
        <Specimen label="with label and description (Figma 3.2)">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={id("waitlist")}>Waitlist</FieldLabel>
              <FieldDescription>
                Offer spots to the waitlist when someone cancels.
              </FieldDescription>
            </FieldContent>
            <Switch id={id("waitlist")} defaultChecked />
          </Field>
        </Specimen>
        <Specimen label="with label">
          <div className="flex items-center gap-3">
            <Switch id={id("newsletter")} defaultChecked />
            <Label htmlFor={id("newsletter")}>Newsletter</Label>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Row alignment"
        spec="§3.2"
        description="Controls in one row share a height: 44px on phones, --size-control (40, or 32 compact) from sm up."
        min="15rem"
      >
        <Specimen label="Input + Select + Buttons" wide>
          <div className="flex w-full flex-wrap items-center gap-3">
            <Input aria-label="Search" placeholder="Search events" className="min-w-40 flex-1" />
            <div className="min-w-40 flex-1">
              <Select defaultValue="3">
                <SelectTrigger aria-label="Year (row)">
                  <SelectValue />
                </SelectTrigger>
                <SelectOptions />
              </Select>
            </div>
            <Button variant="outline">Filter</Button>
            <Button>Search</Button>
          </div>
        </Specimen>
        <Specimen label="Focus ring inside overflow-hidden parent (should not clip)" wide>
          <div className="w-full overflow-hidden rounded-xl border p-2">
            <Input aria-label="Clipped" placeholder="Tab into me" />
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Label, Field and FieldSet"
        spec="§3.2"
        min="17rem"
      >
        <Specimen label="Label alone">
          <Label>Full name</Label>
        </Specimen>
        <Specimen label="Field: label + input + description">
          <Field>
            <FieldLabel htmlFor={id("name")}>Full name</FieldLabel>
            <Input id={id("name")} placeholder="Jane Doe" />
            <FieldDescription>As it appears on your student card.</FieldDescription>
          </Field>
        </Specimen>
        <Specimen label="Field: data-invalid + FieldError">
          <Field data-invalid>
            <FieldLabel htmlFor={id("email")}>Email</FieldLabel>
            <Input id={id("email")} defaultValue="jane@" aria-invalid />
            <FieldError>Enter a valid email address.</FieldError>
          </Field>
        </Specimen>
        <Specimen label="Field: disabled">
          <Field data-disabled>
            <FieldLabel htmlFor={id("disabled")}>Student number</FieldLabel>
            <Input id={id("disabled")} defaultValue="12345678" disabled />
          </Field>
        </Specimen>
        <Specimen label="Field: horizontal switch row">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={id("marketing")}>Marketing emails</FieldLabel>
              <FieldDescription>Occasional news from UX Hub.</FieldDescription>
            </FieldContent>
            <Switch id={id("marketing")} />
          </Field>
        </Specimen>
        <Specimen label="FieldSet: legend + checkboxes">
          <FieldSet className="w-full">
            <FieldLegend>Interests</FieldLegend>
            <FieldGroup className="gap-3">
              {["Research", "Visual design", "Prototyping"].map((name, i) => (
                <Field key={name} orientation="horizontal">
                  <Checkbox id={id(`interest-${i}`)} defaultChecked={i === 0} />
                  <FieldLabel htmlFor={id(`interest-${i}`)}>{name}</FieldLabel>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        </Specimen>
        <Specimen label="FieldLegend variant=label">
          <FieldSet className="w-full">
            <FieldLegend variant="label">Pronouns</FieldLegend>
            <Input aria-label="Pronouns" placeholder="she/her" />
          </FieldSet>
        </Specimen>
        <Specimen label="Radio cards (checked, unchecked)">
          <FieldGroup className="gap-3">
            {[
              { value: "member", title: "Member", note: "$10 · includes free events", checked: true },
              { value: "guest", title: "Guest", note: "$25 · one event", checked: false },
            ].map((option) => (
              <FieldLabel key={option.value} htmlFor={id(`plan-${option.value}`)}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{option.title}</FieldTitle>
                    <FieldDescription>{option.note}</FieldDescription>
                  </FieldContent>
                  <Checkbox
                    id={id(`plan-${option.value}`)}
                    defaultChecked={option.checked}
                    data-state={option.checked ? "checked" : "unchecked"}
                  />
                </Field>
              </FieldLabel>
            ))}
          </FieldGroup>
        </Specimen>
        <Specimen label="FieldSeparator" wide>
          <div className="w-full">
            <FieldSeparator>or</FieldSeparator>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Calendar"
        spec="§3.11"
        description="Single selection, today, range and disabled days."
        min="19rem"
      >
        <Specimen label="today (current month)">
          <Calendar mode="single" defaultMonth={today} />
        </Specimen>
        <Specimen label="single selected">
          <Calendar
            mode="single"
            selected={picked}
            onSelect={setPicked}
            defaultMonth={new Date(2026, 10, 1)}
          />
        </Specimen>
        <Specimen label="range">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            defaultMonth={new Date(2026, 10, 1)}
          />
        </Specimen>
        <Specimen label="disabled days (before the 12th)">
          <Calendar
            mode="single"
            defaultMonth={new Date(2026, 10, 1)}
            disabled={{ before: new Date(2026, 10, 12) }}
          />
        </Specimen>
        <Specimen label="dropdown caption">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            defaultMonth={new Date(2026, 10, 1)}
            startMonth={new Date(2024, 0)}
            endMonth={new Date(2028, 11)}
          />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Form"
        description="A Card holding a FieldSet with four fields (one optional, one invalid), a switch row, and the two actions."
      >
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>
              This is shown to event hosts when you register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldSet>
              <FieldLegend>Personal details</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={id("f-name")}>Full name</FieldLabel>
                  <Input id={id("f-name")} defaultValue="Johnny Dong" />
                </Field>
                <Field data-invalid>
                  <FieldLabel htmlFor={id("f-email")}>Email</FieldLabel>
                  <Input id={id("f-email")} defaultValue="johnny@" aria-invalid />
                  <FieldError>Enter a valid email address.</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor={id("f-year")}>
                    Year <span className="font-normal text-muted-foreground">(Optional)</span>
                  </FieldLabel>
                  <Select>
                    <SelectTrigger id={id("f-year")}>
                      <SelectValue placeholder="Select a year" />
                    </SelectTrigger>
                    <SelectOptions />
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={id("f-bio")}>About you</FieldLabel>
                  <Textarea
                    id={id("f-bio")}
                    placeholder="What do you want to get out of UX Hub?"
                  />
                  <FieldDescription>Up to 300 characters.</FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={id("f-news")}>Newsletter</FieldLabel>
                    <FieldDescription>One email a month.</FieldDescription>
                  </FieldContent>
                  <Switch id={id("f-news")} defaultChecked />
                </Field>
              </FieldGroup>
            </FieldSet>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button>Save changes</Button>
          </CardFooter>
        </Card>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "form-controls",
  title: "Form controls",
  group: "Forms",
  description: "Inputs, textareas, selects, checkboxes and switches, laid out with Field and Label in any form.",
  spec: "§3.2, §3.11, §3.12",
  layout: "split",
  openStates: ["select"],
  Component: FormControls,
};

export default section;
