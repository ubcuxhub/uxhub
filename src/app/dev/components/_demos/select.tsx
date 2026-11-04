"use client";

import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

import { YearSelectOptions } from "./_fixtures/year-select";

function SelectDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Select"
        spec="§3.2"
        description="Trigger states. The menu opens with ?open=select (checked in light and dark)."
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
