"use client";

import { CircleAlert, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldSet, FieldLegend, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { priceError } from "../../lib/event-configuration";
import type { EventFormState } from "./event-form-schema";

interface Props {
  state: EventFormState;
  locked: boolean;
  showErrors?: boolean;
  effectivePrices?: { regular: number; member: number };
  onChange: <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
}

export function EventPricing({ state, locked, effectivePrices, onChange, showErrors = false }: Props) {
  const error = showErrors && state.pricing_mode === "paid" ? priceError(state.pricing_amount) : null;
  const summary = effectivePrices && `Non-members: $${effectivePrices.regular.toFixed(2)} CAD · Members: $${effectivePrices.member.toFixed(2)} CAD`;
  return <div data-slot="card" className="@container/pricing space-y-4 rounded-xl border border-border bg-card p-5">
    <div className="space-y-0.5 border-b border-border-subtle pb-4">
      <h3 className="text-subheading">Pricing</h3>
      <p className="text-muted-foreground">{state.pricing_mode === "legacy" ? "Existing prices are preserved. Configure Free/Paid pricing before registrations begin." : "Members with an active membership get in free. Non-members pay the ticket price."}</p>
    </div>
    {locked ? <Alert variant="neutral" aria-label="Pricing is locked" icon={<Lock aria-hidden strokeWidth={1.5} className="text-muted-foreground" />} className="gap-2.5 py-3.5">
      <AlertTitle className="font-semibold">{summary}</AlertTitle>
      <AlertDescription className="mt-0.5 text-muted-foreground">Locked because registrations or payments exist. A new price would treat people differently for the same event.</AlertDescription>
      {state.pricing_mode !== "legacy" && <p className="mt-2 text-small text-muted-foreground">Saved configuration: {state.pricing_mode === "free" ? "Free" : `$${Number(state.pricing_amount).toFixed(2)} CAD for non-members`}.</p>}
    </Alert>
      : state.pricing_mode === "legacy" ? <div className="space-y-3"><p>{summary || `Non-members: $${state.regular_price || "0"} CAD · Members: $${state.member_price || "0"} CAD`}</p><p className="text-small text-muted-foreground">Existing prices are preserved. Choose Free or Paid to configure the new pricing policy.</p><Button type="button" variant="outline" onClick={() => { onChange("pricing_mode", Number(state.regular_price) === 0 ? "free" : "paid"); onChange("pricing_amount", state.regular_price || "0"); }}>Configure Free/Paid pricing</Button></div>
      : <>
        <FieldSet className="gap-4">
          <FieldLegend className="sr-only">Ticket pricing</FieldLegend>
          <RadioGroup aria-label="Ticket pricing" value={state.pricing_mode} onValueChange={value => onChange("pricing_mode", value as "free" | "paid")} className="grid gap-4 @min-[34rem]/pricing:grid-cols-2">
            {[{ value: "free", title: "Free", note: "No ticket price." }, { value: "paid", title: "Paid", note: "Set the price non-members pay." }].map(option => <FieldLabel key={option.value} htmlFor={`pricing-${option.value}`} className="has-[>[data-slot=field]]:rounded-lg [&>*]:data-[slot=field]:p-3"><Field orientation="horizontal"><RadioGroupItem id={`pricing-${option.value}`} value={option.value} className="mt-0.5" /><FieldContent><FieldTitle>{option.title}</FieldTitle><FieldDescription>{option.note}</FieldDescription></FieldContent></Field></FieldLabel>)}
          </RadioGroup>
        </FieldSet>
        {state.pricing_mode === "paid" && <Field data-invalid={!!error || undefined} className="@min-[34rem]/pricing:max-w-[calc(50%-8px)]"><FieldLabel htmlFor="configured-price">Non-member price (CAD)</FieldLabel><Input id="configured-price" className="min-h-11 sm:min-h-10" type="text" inputMode="decimal" placeholder="E.g. 10.00" value={state.pricing_amount} onChange={event => onChange("pricing_amount", event.target.value)} /><FieldDescription>Use up to two decimal places.</FieldDescription>{error && <FieldError><span className="flex items-start gap-1.5"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</span></FieldError>}</Field>}
      </>}
  </div>;
}
