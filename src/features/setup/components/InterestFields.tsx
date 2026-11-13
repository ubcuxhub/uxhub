"use client";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import { FilterChip } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";

import { INTEREST_GROUPS, INTEREST_OPTIONS, type InterestId } from "../lib/options";

const INTEREST_IDS = new Set<string>(INTEREST_OPTIONS.map((option) => option.id));

/** The taxonomy ids in `interests`, leaving out managers' free tags. */
export function pickInterestIds(interests: readonly string[]): InterestId[] {
  return interests.filter((value): value is InterestId => INTEREST_IDS.has(value));
}

export function selectedCountLabel(count: number): string {
  return `${count} selected`;
}

interface InterestFieldsProps {
  value: readonly InterestId[];
  onChange: (value: InterestId[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Step 3 of setup (Figma 4297:2) and the interests section of Settings: one
 * chip group per taxonomy group. The selected count lives with the caller,
 * which places it beside its own buttons.
 */
export function InterestFields({ value, onChange, disabled, className }: InterestFieldsProps) {
  return (
    <div data-slot="interest-fields" className={cn("flex flex-col gap-6", className)}>
      {INTEREST_GROUPS.map((group) => (
        <FieldSet key={group.id} className="gap-0" disabled={disabled}>
          <FieldLegend variant="label">{group.label}</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <FilterChip
                key={option.id}
                pressed={value.includes(option.id)}
                disabled={disabled}
                onPressedChange={(on) =>
                  onChange(
                    on
                      ? value.includes(option.id)
                        ? [...value]
                        : [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </FieldSet>
      ))}
    </div>
  );
}
