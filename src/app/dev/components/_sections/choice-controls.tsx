"use client";

import { useId, useState } from "react";
import { CalendarClock, History, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

/** Figma 3.12 "Who can register?", one radio list with descriptions. */
function RegisterList({
  legend,
  invalid,
  disabledOption,
  defaultValue,
}: {
  legend: string;
  invalid?: boolean;
  disabledOption?: boolean;
  defaultValue?: string;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup defaultValue={defaultValue} aria-invalid={invalid}>
        <Field orientation="horizontal">
          <RadioGroupItem value="anyone" id={id("anyone")} aria-invalid={invalid} />
          <FieldLabel htmlFor={id("anyone")} className="text-body">
            Anyone with a UX Hub account
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="members" id={id("members")} aria-invalid={invalid} />
          <FieldContent>
            <FieldLabel htmlFor={id("members")} className="text-body">
              Members only
            </FieldLabel>
            <FieldDescription>Anyone with an active membership</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="application" id={id("application")} aria-invalid={invalid} />
          <FieldContent>
            <FieldLabel htmlFor={id("application")} className="text-body">
              By application
            </FieldLabel>
            <FieldDescription>Organizers review each application</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal" data-disabled={disabledOption || undefined}>
          <RadioGroupItem
            value="invite"
            id={id("invite")}
            disabled={disabledOption}
            aria-invalid={invalid}
          />
          <FieldLabel htmlFor={id("invite")} className="text-body">
            Invite only
          </FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  );
}

const CLASSIFICATIONS = [
  {
    value: "student",
    title: "I’m a UBC student",
    note: "Currently enrolled at The University of British Columbia.",
  },
  {
    value: "faculty",
    title: "I’m a UBC faculty member",
    note: "Faculty or staff at The University of British Columbia.",
  },
  {
    value: "non-ubc",
    title: "I’m not from UBC",
    note: "Joining from outside The University of British Columbia.",
  },
] as const;

/** Radio cards: `field.tsx` highlights a `FieldLabel` that wraps a checked radio. */
function RadioCards({ disabled }: { disabled?: boolean }) {
  const uid = useId();
  const [value, setValue] = useState("student");
  return (
    <FieldSet>
      <FieldLegend variant="label">What best describes you?</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={setValue}
        disabled={disabled}
        className="gap-3"
      >
        {CLASSIFICATIONS.map((option) => (
          <FieldLabel key={option.value} htmlFor={`${uid}-${option.value}`}>
            <Field orientation="horizontal" data-disabled={disabled || undefined}>
              <FieldContent>
                <FieldTitle>{option.title}</FieldTitle>
                <FieldDescription>{option.note}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={option.value} id={`${uid}-${option.value}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

function RadioInForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const uid = useId();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(String(data.get("plan") ?? ""));
      }}
    >
      <FieldSet>
        <FieldLegend variant="label">Choose a plan</FieldLegend>
        <RadioGroup name="plan" defaultValue="member" required>
          {["member", "guest"].map((plan) => (
            <Field key={plan} orientation="horizontal">
              <RadioGroupItem value={plan} id={`${uid}-${plan}`} />
              <FieldLabel htmlFor={`${uid}-${plan}`} className="text-body capitalize">
                {plan}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          Submit
        </Button>
        <span className="text-small text-muted-foreground">
          {submitted === null ? "FormData plan: not submitted" : `FormData plan: ${submitted}`}
        </span>
      </div>
    </form>
  );
}

function ControlledToggle() {
  const [value, setValue] = useState("upcoming");
  return (
    <div className="flex flex-col gap-2">
      <SegmentedToggle aria-label="Show events" value={value} onValueChange={setValue}>
        <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
        <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
      </SegmentedToggle>
      <span className="text-label text-muted-foreground">value: {value}</span>
    </div>
  );
}

function StatefulChip({
  label,
  count,
  defaultPressed,
  disabled,
}: {
  label: string;
  count?: number;
  defaultPressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <FilterChip count={count} defaultPressed={defaultPressed} disabled={disabled}>
      {label}
    </FilterChip>
  );
}

const STATUS_CHIPS = [
  { key: "pending", label: "Pending", count: 12 },
  { key: "accepted", label: "Accepted", count: 4 },
  { key: "waitlisted", label: "Waitlisted", count: 2 },
  { key: "not-selected", label: "Not selected", count: 9 },
] as const;

function StatusFilters() {
  const [active, setActive] = useState<string[]>(["pending"]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <FilterChipGroup aria-label="Filter applications by status">
        {STATUS_CHIPS.map((chip) => (
          <FilterChip
            key={chip.key}
            count={chip.count}
            pressed={active.includes(chip.key)}
            onPressedChange={(on) =>
              setActive((prev) =>
                on ? [...prev, chip.key] : prev.filter((key) => key !== chip.key),
              )
            }
          >
            {chip.label}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <Button
        variant="ghost"
        size="sm"
        disabled={active.length === 0}
        onClick={() => setActive([])}
      >
        Clear filters
      </Button>
    </div>
  );
}

function ChoiceControls() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Radio"
        spec="§3.12"
        description="2–5 options compared at a glance. One group per question, the question as its legend. Tab lands on the selected radio; arrows move and select. Focus rings are checked from the keyboard."
        min="17rem"
      >
        <Specimen label="unchecked">
          <RadioGroup aria-label="Unchecked">
            <RadioGroupItem value="a" aria-label="Unchecked" />
          </RadioGroup>
        </Specimen>
        <Specimen label="checked">
          <RadioGroup aria-label="Checked" defaultValue="a">
            <RadioGroupItem value="a" aria-label="Checked" />
          </RadioGroup>
        </Specimen>
        <Specimen label="aria-invalid">
          <RadioGroup aria-label="Invalid">
            <RadioGroupItem value="a" aria-label="Invalid" aria-invalid />
          </RadioGroup>
        </Specimen>
        <Specimen label="disabled">
          <RadioGroup aria-label="Disabled" disabled>
            <RadioGroupItem value="a" aria-label="Disabled" />
          </RadioGroup>
        </Specimen>
        <Specimen label="disabled, checked">
          <RadioGroup aria-label="Disabled checked" defaultValue="a" disabled>
            <RadioGroupItem value="a" aria-label="Disabled checked" />
          </RadioGroup>
        </Specimen>
        <Specimen label="list, legend, descriptions (Figma 3.12)">
          <RegisterList legend="Who can register?" defaultValue="anyone" disabledOption />
        </Specimen>
        <Specimen label="list, error">
          <div className="flex flex-col gap-3">
            <RegisterList legend="Who can register?" invalid />
            <FieldError>Choose who can register.</FieldError>
          </div>
        </Specimen>
        <Specimen label="list, disabled">
          <FieldSet disabled>
            <FieldLegend variant="label">Who can register?</FieldLegend>
            <RadioGroup defaultValue="Members only" disabled>
              {["Members only", "By application"].map((label) => (
                <Field key={label} orientation="horizontal" data-disabled>
                  <RadioGroupItem value={label} aria-label={label} />
                  <span className="text-body text-text-disabled">{label}</span>
                </Field>
              ))}
            </RadioGroup>
          </FieldSet>
        </Specimen>
        <Specimen label="radio cards (membership copy)" wide>
          <div className="w-full max-w-xl">
            <RadioCards />
          </div>
        </Specimen>
        <Specimen label="radio cards, disabled" wide>
          <div className="w-full max-w-xl">
            <RadioCards disabled />
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="SegmentedToggle"
        spec="§3.2"
        description="Two or three options that switch a view and never submit. The selected option can’t be deselected. Arrows move focus; Space or Enter selects."
        min="17rem"
      >
        <Specimen label="Upcoming / Past, controlled">
          <ControlledToggle />
        </Specimen>
        <Specimen label="three options">
          <SegmentedToggle aria-label="Application view" defaultValue="all">
            <SegmentedToggleItem value="all">All</SegmentedToggleItem>
            <SegmentedToggleItem value="mine">Assigned to me</SegmentedToggleItem>
            <SegmentedToggleItem value="done">Reviewed</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="with icons">
          <SegmentedToggle aria-label="Event layout" defaultValue="timeline">
            <SegmentedToggleItem value="timeline">
              <CalendarClock aria-hidden />
              Timeline
            </SegmentedToggleItem>
            <SegmentedToggleItem value="list">
              <LayoutList aria-hidden />
              List
            </SegmentedToggleItem>
            <SegmentedToggleItem value="past">
              <History aria-hidden />
              Past
            </SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="one option disabled">
          <SegmentedToggle aria-label="Event layout, one disabled" defaultValue="upcoming">
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
            <SegmentedToggleItem value="drafts" disabled>
              Drafts
            </SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="all disabled">
          <SegmentedToggle aria-label="Disabled toggle" defaultValue="upcoming" disabled>
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="className=&quot;w-full&quot;: options share the width" wide>
          <SegmentedToggle
            aria-label="Full width toggle"
            defaultValue="upcoming"
            className="w-full sm:max-w-sm"
          >
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="FilterChip"
        spec="§3.3"
        description="Toggles a filter on a list; several can be on at once. Selected shows a check as well as the tint. Space or Enter flips aria-pressed."
        min="14rem"
      >
        <Specimen label="off">
          <StatefulChip label="Workshops" />
        </Specimen>
        <Specimen label="on">
          <StatefulChip label="In person" defaultPressed />
        </Specimen>
        <Specimen label="off, with count">
          <StatefulChip label="Workshops" count={4} />
        </Specimen>
        <Specimen label="on, with count">
          <StatefulChip label="Workshops" count={4} defaultPressed />
        </Specimen>
        <Specimen label="disabled">
          <StatefulChip label="Hybrid" disabled />
        </Specimen>
        <Specimen label="disabled, on">
          <StatefulChip label="Hybrid" defaultPressed disabled />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Application status filters"
        description="A FilterChipGroup with counts, and a ghost “Clear filters” beside it. The chips combine."
      >
        <StatusFilters />
      </Composition>

      <Composition
        title="Radio inside a form"
        description="The value reaches FormData through Radix’s hidden input. Nothing auto-submits; the form’s button does."
      >
        <RadioInForm />
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "choice-controls",
  title: "Choice controls",
  spec: "§3.2, §3.3, §3.12",
  layout: "split",
  Component: ChoiceControls,
};

export default section;
