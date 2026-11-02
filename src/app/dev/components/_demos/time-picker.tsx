"use client";

import { TimePicker } from "@/components/ui/time-picker";
import { timeOptions } from "@/lib/date-input";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function TimePickerDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="TimePicker"
        spec="§3.11"
        description="The popover list on its own, as it looks when open. TimeField (see Date and time fields) wraps it for typing."
        min="min(22rem, 100%)"
      >
        <Specimen label="TimePicker: start" bare>
          <div className="overlay-surface w-60 rounded-2xl p-2">
            <TimePicker options={timeOptions()} value="09:00" onValueChange={() => {}} />
          </div>
        </Specimen>
        <Specimen label="TimePicker: end, after 10:00 AM, with durations" bare>
          <div className="overlay-surface w-60 rounded-2xl p-2">
            <TimePicker
              options={timeOptions({ after: "10:00" })}
              value="12:00"
              onValueChange={() => {}}
              activeIndex={9}
            />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TimePickerDemo;
