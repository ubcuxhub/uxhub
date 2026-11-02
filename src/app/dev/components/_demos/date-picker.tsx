"use client";

import { DatePicker } from "@/components/ui/date-picker";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { DATE, TODAY } from "./_fixtures/date-time";

function DatePickerDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="DatePicker"
        spec="§3.11"
        description="The popover panel on its own, as it looks when open. Today is Nov 4, 2026. DateField (see Date and time fields) wraps it for typing."
        min="min(22rem, 100%)"
      >
        <Specimen label="DatePicker: today, selected" bare>
          <div className="overlay-surface w-82 max-w-full rounded-2xl p-4">
            <DatePicker value={DATE} onValueChange={() => {}} today="2026-11-01" />
          </div>
        </Specimen>
        <Specimen label="DatePicker: out of range (min = today)" bare>
          <div className="overlay-surface w-82 max-w-full rounded-2xl p-4">
            <DatePicker value={DATE} onValueChange={() => {}} today={TODAY} min={TODAY} />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default DatePickerDemo;
