"use client";

import { SortFilterSection } from "@/components/shared/SortFilterPanel";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";

/**
 * One group of filter chips in an admin list's SortFilterPanel. Chips in a
 * group are alternatives (any of them matches); groups intersect.
 */
export function ChipFilterSection<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly { value: T; label: string }[];
  selected: ReadonlySet<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <SortFilterSection title={title}>
      <FilterChipGroup aria-label={title}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            pressed={selected.has(option.value)}
            onPressedChange={() => onToggle(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </FilterChipGroup>
    </SortFilterSection>
  );
}
