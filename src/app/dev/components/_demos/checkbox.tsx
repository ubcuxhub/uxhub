"use client";

import { useEffect, useId, useRef } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

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

function CheckboxDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Checkbox" spec="§3.2">
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
    </div>
  );
}

export default CheckboxDemo;
