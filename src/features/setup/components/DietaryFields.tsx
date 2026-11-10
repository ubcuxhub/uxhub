"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import {
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  ALLERGY_OPTIONS,
  DIET_OPTIONS,
  OTHER_ALLERGIES_MAX,
  OTHER_ALLERGY_MAX_LENGTH,
  type AllergyId,
  type DietId,
} from "../lib/options";
import type { DietaryNeeds } from "../lib/validation";

/**
 * The dietary answer while it's being edited. `none` is the "I don't have any
 * dietary needs" chip: saved, it's the same as all three lists empty, but
 * setup keeps it apart so an untouched form can ask for an answer. `pending`
 * is text typed into Other allergies but not yet added.
 */
export interface DietaryValue extends DietaryNeeds {
  none: boolean;
  pending: string;
}

export function isDietaryEmpty(value: DietaryNeeds): boolean {
  return !value.diets.length && !value.allergies.length && !value.otherAllergies.length;
}

/**
 * Starts the editor from saved needs. `answered` says whether empty lists
 * mean "no dietary needs" (an answer) or "not asked yet".
 */
export function toDietaryValue(needs: DietaryNeeds, answered: boolean): DietaryValue {
  return {
    diets: [...needs.diets],
    allergies: [...needs.allergies],
    otherAllergies: [...needs.otherAllergies],
    none: answered && isDietaryEmpty(needs),
    pending: "",
  };
}

/**
 * Adds `entry` to the other allergies, or says why it can't. Matching the
 * server's rules (`normalizeOtherAllergies`) here means a save never fails
 * on them.
 */
export function addOtherAllergy(
  list: readonly string[],
  entry: string,
): { list: string[]; error: string | null } {
  const value = entry.trim();
  if (!value) return { list: [...list], error: null };
  if (value.length > OTHER_ALLERGY_MAX_LENGTH) {
    return { list: [...list], error: `Keep each allergy under ${OTHER_ALLERGY_MAX_LENGTH} characters.` };
  }
  if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
    return { list: [...list], error: `${value} is already on the list.` };
  }
  if (list.length >= OTHER_ALLERGIES_MAX) {
    return { list: [...list], error: `Add at most ${OTHER_ALLERGIES_MAX} other allergies.` };
  }
  return { list: [...list, value], error: null };
}

/**
 * The value to save: typed-but-not-added text is added first, so pressing
 * Save never drops what the member wrote. Returns the add error instead when
 * that text can't be added.
 */
export function resolveDietary(value: DietaryValue): { needs: DietaryNeeds } | { error: string } {
  const added = addOtherAllergy(value.otherAllergies, value.pending);
  if (added.error && value.pending.trim()) return { error: added.error };
  return { needs: { diets: value.diets, allergies: value.allergies, otherAllergies: added.list } };
}

function toggle<T extends string>(list: readonly T[], id: T, on: boolean): T[] {
  return on ? (list.includes(id) ? [...list] : [...list, id]) : list.filter((item) => item !== id);
}

interface DietaryFieldsProps {
  value: DietaryValue;
  onChange: (value: DietaryValue) => void;
  disabled?: boolean;
  /** A form-level error, e.g. nothing chosen. Shown under the None chip. */
  error?: string | null;
  className?: string;
}

/**
 * Step 1 of setup (Figma 4289:2), and the dietary section of Settings: diet
 * and allergy chips, an "Other allergies" entry list, and "I don't have any
 * dietary needs", which clears everything else and is cleared by it.
 */
export function DietaryFields({ value, onChange, disabled, error, className }: DietaryFieldsProps) {
  const inputId = useId();
  const hintId = useId();
  const [inputError, setInputError] = useState<string | null>(null);
  const inputErrorId = useId();

  const patch = (next: Partial<DietaryValue>) => onChange({ ...value, ...next });

  const commitPending = () => {
    const added = addOtherAllergy(value.otherAllergies, value.pending);
    setInputError(added.error);
    if (added.error || !value.pending.trim()) return false;
    patch({ otherAllergies: added.list, pending: "", none: false });
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    // Enter adds an entry; it must not submit a surrounding form.
    event.preventDefault();
    commitPending();
  };

  return (
    <div data-slot="dietary-fields" className={cn("flex flex-col gap-6", className)}>
      <FieldSet className="gap-0" disabled={disabled}>
        <FieldLegend variant="label">Diet</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              pressed={value.diets.includes(option.id)}
              disabled={disabled}
              onPressedChange={(on) =>
                patch({ diets: toggle<DietId>(value.diets, option.id, on), none: false })
              }
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </FieldSet>

      <FieldSet className="gap-0" disabled={disabled}>
        <FieldLegend variant="label">Allergies and intolerances</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              pressed={value.allergies.includes(option.id)}
              disabled={disabled}
              onPressedChange={(on) =>
                patch({ allergies: toggle<AllergyId>(value.allergies, option.id, on), none: false })
              }
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </FieldSet>

      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId} className="text-body-medium">
          Other allergies
        </Label>
        <Input
          id={inputId}
          value={value.pending}
          placeholder="e.g. sesame"
          disabled={disabled}
          maxLength={OTHER_ALLERGY_MAX_LENGTH + 1}
          enterKeyHint="enter"
          autoComplete="off"
          aria-invalid={inputError ? true : undefined}
          aria-describedby={inputError ? `${inputErrorId} ${hintId}` : hintId}
          onChange={(event) => {
            setInputError(null);
            patch({ pending: event.target.value });
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (value.pending.trim()) commitPending();
          }}
        />
        {inputError ? (
          <p id={inputErrorId} role="alert" className="text-small text-destructive">
            {inputError}
          </p>
        ) : null}
        <FieldDescription id={hintId}>Press Enter to add each one.</FieldDescription>
        {value.otherAllergies.length ? (
          <ul aria-label="Other allergies added" className="flex flex-wrap gap-2">
            {value.otherAllergies.map((entry) => (
              <li
                key={entry}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border py-1 pr-1 pl-3 text-small"
              >
                <span className="min-w-0 truncate">{entry}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${entry}`}
                  className="relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:focus-ring disabled:cursor-not-allowed pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
                  onClick={() => {
                    const rest = value.otherAllergies.filter((item) => item !== entry);
                    patch({ otherAllergies: rest });
                    // The button is gone after this; keep focus in the field.
                    document.getElementById(inputId)?.focus();
                  }}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <FieldSeparator>or</FieldSeparator>

      <div className="flex flex-col gap-2">
        <div>
          <FilterChip
            pressed={value.none}
            disabled={disabled}
            onPressedChange={(on) =>
              onChange(
                on
                  ? { diets: [], allergies: [], otherAllergies: [], pending: "", none: true }
                  : { ...value, none: false },
              )
            }
          >
            I don&apos;t have any dietary needs
          </FilterChip>
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
