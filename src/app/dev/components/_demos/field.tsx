"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
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
  FieldValidation,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLabelRow,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { YearSelectOptions } from "./_fixtures/year-select";

function FieldDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Label, Field and FieldSet"
        spec="§3.2"
        description="Label (src/components/ui/label.tsx) has no page of its own: on its own it is a plain form label, and inside a Field you use FieldLabel instead."
      >
        <Specimen label="Validator feedback (FieldValidation)" className="w-64">
          <FieldValidation errors={[{ target: "demo-event", message: "Event name is required." }]}>
            <Field validationKey="demo-event"><FieldLabel htmlFor={id("validated")}>Event name</FieldLabel><Input id={id("validated")} /></Field>
          </FieldValidation>
        </Specimen>
        <Specimen label="Label alone">
          <Label>Full name</Label>
        </Specimen>
        <Specimen label="Field: label + input + description" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("name")}>Full name</FieldLabel>
            <Input id={id("name")} placeholder="Jane Doe" />
            <FieldDescription>As it appears on your student card.</FieldDescription>
          </Field>
        </Specimen>
        <Specimen label="Field: data-invalid + FieldError" className="w-64">
          <Field data-invalid>
            <FieldLabel htmlFor={id("email")}>Email</FieldLabel>
            <Input id={id("email")} defaultValue="jane@" aria-invalid />
            <FieldError>Enter a valid email address.</FieldError>
          </Field>
        </Specimen>
        <Specimen label="Field: disabled" className="w-64">
          <Field data-disabled>
            <FieldLabel htmlFor={id("disabled")}>Student number</FieldLabel>
            <Input id={id("disabled")} defaultValue="12345678" disabled />
          </Field>
        </Specimen>
        <Specimen label="Field: horizontal switch row" className="w-64">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={id("marketing")}>Marketing emails</FieldLabel>
              <FieldDescription>Occasional news from UX Hub.</FieldDescription>
            </FieldContent>
            <Switch id={id("marketing")} />
          </Field>
        </Specimen>
        <Specimen label="FieldSet: legend + checkboxes" className="w-64">
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
        <Specimen label="FieldLegend variant=label" className="w-64">
          <FieldSet className="w-full">
            <FieldLegend variant="label">Pronouns</FieldLegend>
            <Input aria-label="Pronouns" placeholder="she/her" />
          </FieldSet>
        </Specimen>
        <Specimen label="Radio cards (checked, unchecked)" className="w-64">
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
        title="Label row with an action"
        spec="§3.2"
        description="Label first in the DOM, then the action: Tab goes label action, then the input. Passwords have no placeholder."
      >
        <Specimen label="Sign-in password" className="w-64">
          <Field>
            <FieldLabelRow
              action={
                <a
                  href="#forgot-password"
                  className="rounded-sm text-small text-primary underline-offset-4 hover:underline focus-visible:focus-ring"
                >
                  Forgot password?
                </a>
              }
            >
              <FieldLabel htmlFor={id("password")}>Password</FieldLabel>
            </FieldLabelRow>
            <Input
              id={id("password")}
              type="password"
              autoComplete="current-password"
            />
          </Field>
        </Specimen>
        <Specimen label="No action (label alone)" className="w-64">
          <Field>
            <FieldLabelRow>
              <FieldLabel htmlFor={id("full-name")}>Full name</FieldLabel>
            </FieldLabelRow>
            <Input id={id("full-name")} defaultValue="Johnny Dong" />
          </Field>
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
                    <YearSelectOptions />
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

export default FieldDemo;
