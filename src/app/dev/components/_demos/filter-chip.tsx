"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

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

function FilterChipDemo() {
  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}

export default FilterChipDemo;
