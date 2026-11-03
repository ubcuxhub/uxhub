"use client";

import { useId } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function SwitchDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Switch" spec="§3.2">
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
        <Specimen label="with label and description (Figma 3.2)" className="w-80">
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
    </div>
  );
}

export default SwitchDemo;
