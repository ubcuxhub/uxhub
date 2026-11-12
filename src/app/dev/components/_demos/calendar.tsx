"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function CalendarDemo() {
  const today = new Date();
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 10, 10),
    to: new Date(2026, 10, 14),
  });
  const [picked, setPicked] = useState<Date | undefined>(
    new Date(2026, 10, 18),
  );

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Calendar"
        spec="§3.11"
        description="Single selection, today, range and disabled days."
      >
        <Specimen label="today (current month)">
          <Calendar mode="single" defaultMonth={today} />
        </Specimen>
        <Specimen label="single selected">
          <Calendar
            mode="single"
            selected={picked}
            onSelect={setPicked}
            defaultMonth={new Date(2026, 10, 1)}
          />
        </Specimen>
        <Specimen label="range">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            defaultMonth={new Date(2026, 10, 1)}
          />
        </Specimen>
        <Specimen label="disabled days (before the 12th)">
          <Calendar
            mode="single"
            defaultMonth={new Date(2026, 10, 1)}
            disabled={{ before: new Date(2026, 10, 12) }}
          />
        </Specimen>
        <Specimen label="dropdown caption">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            defaultMonth={new Date(2026, 10, 1)}
            startMonth={new Date(2024, 0)}
            endMonth={new Date(2028, 11)}
          />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default CalendarDemo;
