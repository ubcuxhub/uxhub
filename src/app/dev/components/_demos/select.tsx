"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

import { YearSelectOptions } from "./_fixtures/year-select";

function SelectDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Select"
        spec="§3.2"
        description="Enabled triggers show a pointer cursor; disabled triggers show not-allowed. The menu opens with ?open=select (checked in light and dark)."
      >
        <Specimen label="placeholder" className="w-56">
          <Select>
            <SelectTrigger aria-label="Year (placeholder)">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Specimen>
        <Specimen label="with value" className="w-56">
          <Select defaultValue="3">
            <SelectTrigger aria-label="Year (value)">
              <SelectValue />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Specimen>
        <Specimen label="Two-line value, card-radius corners, wrapping long content" className="w-64">
          <Select defaultValue="opening">
            <SelectTrigger multiline aria-label="Check-in item"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opening" description="Nov 15 · 11:00 AM – 12:00 PM PT">Opening session with a long descriptive name</SelectItem>
              <SelectItem value="overnight" description="Nov 15 · 11:00 PM – Nov 16 · 1:00 AM PT">Overnight workshop</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="aria-invalid" className="w-56">
          <Select>
            <SelectTrigger aria-label="Year (invalid)" aria-invalid>
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Specimen>
        <Specimen label="disabled" className="w-56">
          <Select disabled defaultValue="2">
            <SelectTrigger aria-label="Year (disabled)">
              <SelectValue />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Specimen>
        <Specimen label="Menu (?open=select)" className="w-56">
          <Select defaultOpen={open === "select"} defaultValue="3">
            <SelectTrigger aria-label="Year (menu)">
              <SelectValue />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SelectDemo;
