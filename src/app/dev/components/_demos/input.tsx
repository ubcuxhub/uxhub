"use client";

import { Mail, Search } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { YearSelectOptions } from "./_fixtures/year-select";

/** The focus ring a keyboard user sees, forced on so it can be looked at. */
const FORCED_FOCUS = "focus-ring";

function InputDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Input"
        spec="§3.2"
        description="Default, filled, invalid and disabled. The invalid state is the aria-invalid attribute callers already set."
      >
        <Specimen label="empty, placeholder" className="w-64">
          <Input aria-label="Empty" placeholder="Enter your name" />
        </Specimen>
        <Specimen label="filled" className="w-64">
          <Input aria-label="Filled" defaultValue="Johnny Dong" />
        </Specimen>
        <Specimen label="aria-invalid" className="w-64">
          <Input aria-label="Invalid" defaultValue="not-an-email" aria-invalid />
        </Specimen>
        <Specimen label="disabled, empty" className="w-64">
          <Input aria-label="Disabled" placeholder="Enter your name" disabled />
        </Specimen>
        <Specimen label="disabled, filled" className="w-64">
          <Input aria-label="Disabled filled" defaultValue="Johnny Dong" disabled />
        </Specimen>
        <Specimen label="type=email" className="w-64">
          <Input aria-label="Email" type="email" placeholder="you@student.ubc.ca" />
        </Specimen>
        <Specimen label="type=password" className="w-64">
          <Input aria-label="Password" type="password" defaultValue="hunter2hunter2" />
        </Specimen>
        <Specimen label="type=number" className="w-64">
          <Input aria-label="Number" type="number" defaultValue={40} />
        </Specimen>
        <Specimen label="type=file" className="w-64">
          <Input aria-label="File" type="file" />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Input with a leading icon"
        spec="§3.2"
        description="A 16px icon, 20px in from the edge, text starting at 44px. The icon is decorative; the label names the field."
      >
        <Specimen label="Mail · default" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("mail-default")}>Email address</FieldLabel>
            <Input
              id={id("mail-default")}
              leadingIcon={Mail}
              placeholder="name@student.ubc.ca"
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · filled" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("mail-filled")}>Email address</FieldLabel>
            <Input
              id={id("mail-filled")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · focus (ring forced on)" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("mail-focus")}>Email address</FieldLabel>
            <Input
              id={id("mail-focus")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
              className={FORCED_FOCUS}
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · error" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("mail-error")}>Email address</FieldLabel>
            <Input
              id={id("mail-error")}
              leadingIcon={Mail}
              defaultValue="name@student"
              aria-invalid
              aria-describedby={id("mail-error-text")}
            />
            <FieldError id={id("mail-error-text")}>
              Enter an email address like name@student.ubc.ca.
            </FieldError>
          </Field>
        </Specimen>
        <Specimen label="Mail · disabled" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("mail-disabled")}>Email address</FieldLabel>
            <Input
              id={id("mail-disabled")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
              disabled
            />
          </Field>
        </Specimen>

        <Specimen label="Search · default" className="w-64">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            placeholder="Search users"
          />
        </Specimen>
        <Specimen label="Search · filled" className="w-64">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="Alex Chen"
          />
        </Specimen>
        <Specimen label="Search · focus (ring forced on)" className="w-64">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="Alex Chen"
            className={FORCED_FOCUS}
          />
        </Specimen>
        <Specimen label="Search · error" className="w-64">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="@@"
            aria-invalid
          />
        </Specimen>
        <Specimen label="Search · disabled" className="w-64">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            placeholder="Search users"
            disabled
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Row alignment"
        spec="§3.2"
        description="Controls in one row share a height: 44px on phones, --size-control (40, or 32 compact) from sm up."
      >
        <Specimen label="Input + Select + Buttons" wide>
          <div className="flex w-full flex-wrap items-center gap-3">
            <Input aria-label="Search" placeholder="Search events" className="min-w-40 flex-1" />
            <div className="min-w-40 flex-1">
              <Select defaultValue="3">
                <SelectTrigger aria-label="Year (row)">
                  <SelectValue />
                </SelectTrigger>
                <YearSelectOptions />
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
    </div>
  );
}

export default InputDemo;
