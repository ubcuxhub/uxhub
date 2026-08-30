"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveAdminSponsorAction } from "@/features/admin/actions";
import type { SponsorRow } from "@/types/models";
import type { SponsorDraft } from "./event-form-schema";

interface SponsorsSectionProps {
  enabled: boolean;
  sponsors: SponsorDraft[];
  options: SponsorRow[];
  onEnabledChange: (enabled: boolean) => void;
  onChange: Dispatch<SetStateAction<SponsorDraft[]>>;
}

const blankSponsor = (): SponsorDraft => ({
  isEditing: true,
  name: "",
  brand_logo_path: "",
});

export function SponsorsSection({
  enabled,
  sponsors,
  options,
  onEnabledChange,
  onChange,
}: SponsorsSectionProps) {
  const router = useRouter();
  const editBaselines = useRef<Record<string, SponsorDraft>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({});

  const chooseExisting = (index: number, id: string) => {
    const sponsor = options.find((option) => option.id === id);
    if (!sponsor) return;
    onChange((current) =>
      current.map((currentSponsor, sponsorIndex) =>
        sponsorIndex === index
          ? {
              id: sponsor.id,
              isEditing: false,
              name: sponsor.name,
              brand_logo_path: sponsor.brand_logo_path ?? "",
            }
          : currentSponsor
      )
    );
  };

  const update = <K extends keyof SponsorDraft>(
    index: number,
    field: K,
    value: SponsorDraft[K]
  ) =>
    onChange((current) =>
      current.map((sponsor, sponsorIndex) =>
        sponsorIndex === index ? { ...sponsor, [field]: value } : sponsor
      )
    );

  const startEditing = (index: number) => {
    const sponsor = sponsors[index];
    if (sponsor.id) editBaselines.current[sponsor.id] = { ...sponsor };
    update(index, "isEditing", true);
  };

  const cancelEditing = (index: number) => {
    const sponsor = sponsors[index];
    if (!sponsor.id) {
      onChange((current) =>
        current.filter((_, sponsorIndex) => sponsorIndex !== index)
      );
    } else {
      const sponsorId = sponsor.id;
      onChange((current) =>
        current.map((currentSponsor, sponsorIndex) =>
          sponsorIndex === index
            ? {
                ...(editBaselines.current[sponsorId] ?? currentSponsor),
                isEditing: false,
              }
            : currentSponsor
        )
      );
    }
    if (sponsor.id) delete editBaselines.current[sponsor.id];
    setCardErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const saveCard = async (index: number) => {
    const sponsor = sponsors[index];
    if (!sponsor.name.trim()) {
      setCardErrors((current) => ({
        ...current,
        [index]: "Sponsor name is required.",
      }));
      return;
    }
    setSavingIndex(index);
    setCardErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    try {
      const saved = await saveAdminSponsorAction(sponsor);
      onChange((current) =>
        current.map((currentSponsor, sponsorIndex) =>
          sponsorIndex === index
            ? {
                id: saved.id,
                isEditing: false,
                name: saved.name,
                brand_logo_path: saved.brand_logo_path ?? "",
              }
            : currentSponsor
        )
      );
      if (sponsor.id) delete editBaselines.current[sponsor.id];
      router.refresh();
    } catch (error) {
      setCardErrors((current) => ({
        ...current,
        [index]:
          error instanceof Error ? error.message : "Failed to save sponsor.",
      }));
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <FieldSet className="gap-4">
      <div className="flex items-center justify-between gap-4">
        <FieldLegend>Sponsors</FieldLegend>
        <div className="flex items-center gap-2">
          <Switch
            id="sponsors_enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <FieldLabel htmlFor="sponsors_enabled">Enabled</FieldLabel>
        </div>
      </div>
      {enabled && (
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sponsors.map((sponsor, index) => (
            <div
              key={sponsor.id ?? `new-sponsor-${index}`}
              className="relative flex min-h-56 flex-col gap-4 rounded-xl border bg-card p-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1"
                aria-label={`Remove sponsor ${index + 1}`}
                onClick={() =>
                  onChange((current) =>
                    current.filter((_, sponsorIndex) => sponsorIndex !== index)
                  )
                }
              >
                <X />
              </Button>
              {sponsor.id && sponsor.isEditing && (
                <p
                  className="flex items-start gap-2 pr-8 text-small text-amber-700 dark:text-amber-400"
                  role="note"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  This is a shared sponsor. Changes will appear on every event
                  using this sponsor.
                </p>
              )}
              <Field>
                <FieldLabel>Use Existing Sponsor</FieldLabel>
                <Select
                  value={sponsor.id}
                  onValueChange={(id) => chooseExisting(index, id)}
                  disabled={!sponsor.isEditing || Boolean(sponsor.id)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Create new sponsor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`sponsor_name_${index}`}>Name</FieldLabel>
                <Input
                  id={`sponsor_name_${index}`}
                  value={sponsor.name}
                  readOnly={!sponsor.isEditing}
                  onChange={(event) =>
                    update(index, "name", event.target.value)
                  }
                  required
                />
              </Field>
              <div className="flex flex-1 items-center justify-center rounded-lg bg-muted p-4">
                <Button type="button" variant="outline" disabled>
                  Upload coming later
                </Button>
              </div>
              <div className="mt-auto flex items-center justify-end gap-2">
                {cardErrors[index] && (
                  <FieldError className="mr-auto">
                    {cardErrors[index]}
                  </FieldError>
                )}
                {sponsor.isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cancelEditing(index)}
                      disabled={savingIndex === index}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => saveCard(index)}
                      disabled={savingIndex === index}
                    >
                      <Save data-icon="inline-start" />
                      {savingIndex === index ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Edit sponsor ${sponsor.name}`}
                    onClick={() => startEditing(index)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-56"
            onClick={() =>
              onChange((current) => [...current, blankSponsor()])
            }
          >
            <Plus data-icon="inline-start" />
            Add Sponsor
          </Button>
        </FieldGroup>
      )}
    </FieldSet>
  );
}
