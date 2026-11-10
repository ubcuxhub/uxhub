"use client";

import { useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function PasswordInputDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <SpecimenGroup
      title="PasswordInput"
      spec="§3.2"
      description="Input with a show/hide button. The button keeps one name, “Show password”, and aria-pressed says whether the password is showing. No placeholder: passwords have none."
    >
      <Specimen label="empty" className="w-72">
        <Field>
          <FieldLabel htmlFor={id("empty")}>Password</FieldLabel>
          <PasswordInput id={id("empty")} autoComplete="current-password" />
        </Field>
      </Specimen>
      <Specimen label="filled, hidden" className="w-72">
        <Field>
          <FieldLabel htmlFor={id("filled")}>Password</FieldLabel>
          <PasswordInput
            id={id("filled")}
            autoComplete="current-password"
            defaultValue="correct horse battery"
          />
        </Field>
      </Specimen>
      <Specimen label="filled, shown (pressed)" className="w-72">
        <Field>
          <FieldLabel htmlFor={id("shown")}>Password</FieldLabel>
          <PasswordInput
            id={id("shown")}
            autoComplete="current-password"
            defaultValue="correct horse battery"
            defaultVisible
          />
        </Field>
      </Specimen>
      <Specimen label="new password, with hint" className="w-72">
        <Field>
          <FieldLabel htmlFor={id("new")}>Password</FieldLabel>
          <PasswordInput id={id("new")} autoComplete="new-password" />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
      </Specimen>
      <Specimen label="invalid" className="w-72">
        <Field data-invalid>
          <FieldLabel htmlFor={id("invalid")}>Password</FieldLabel>
          <PasswordInput
            id={id("invalid")}
            autoComplete="new-password"
            defaultValue="short"
            aria-invalid
          />
          <FieldError>Use at least 8 characters.</FieldError>
        </Field>
      </Specimen>
      <Specimen label="disabled" className="w-72">
        <Field>
          <FieldLabel htmlFor={id("disabled")}>Password</FieldLabel>
          <PasswordInput id={id("disabled")} defaultValue="locked value" disabled />
        </Field>
      </Specimen>
    </SpecimenGroup>
  );
}

export default PasswordInputDemo;
