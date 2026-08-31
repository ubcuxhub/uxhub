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
import { Textarea } from "@/components/ui/textarea";
import { saveAdminMentorAction } from "@/features/admin/actions";
import type { MentorRow } from "@/types/models";
import type { MentorDraft } from "./event-form-schema";

interface MentorsSectionProps {
  enabled: boolean;
  mentors: MentorDraft[];
  options: MentorRow[];
  onEnabledChange: (enabled: boolean) => void;
  onChange: Dispatch<SetStateAction<MentorDraft[]>>;
}

const blankMentor = (): MentorDraft => ({
  isEditing: true,
  full_name: "",
  position: "",
  linkedin_url: "",
  description: "",
  profile_image_path: "",
});

export function MentorsSection({
  enabled,
  mentors,
  options,
  onEnabledChange,
  onChange,
}: MentorsSectionProps) {
  const router = useRouter();
  const editBaselines = useRef<Record<string, MentorDraft>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({});

  const update = <K extends keyof MentorDraft>(
    index: number,
    field: K,
    value: MentorDraft[K]
  ) =>
    onChange((current) =>
      current.map((mentor, mentorIndex) =>
        mentorIndex === index ? { ...mentor, [field]: value } : mentor
      )
    );

  const chooseExisting = (index: number, id: string) => {
    const mentor = options.find((option) => option.id === id);
    if (!mentor) return;
    onChange((current) =>
      current.map((currentMentor, mentorIndex) =>
        mentorIndex === index
          ? {
              id: mentor.id,
              isEditing: false,
              full_name: mentor.full_name,
              position: mentor.position ?? "",
              linkedin_url: mentor.linkedin_url ?? "",
              description: mentor.description ?? "",
              profile_image_path: mentor.profile_image_path ?? "",
            }
          : currentMentor
      )
    );
  };

  const startEditing = (index: number) => {
    const mentor = mentors[index];
    if (mentor.id) editBaselines.current[mentor.id] = { ...mentor };
    update(index, "isEditing", true);
  };

  const cancelEditing = (index: number) => {
    const mentor = mentors[index];
    if (!mentor.id) {
      onChange((current) =>
        current.filter((_, mentorIndex) => mentorIndex !== index)
      );
    } else {
      const mentorId = mentor.id;
      onChange((current) =>
        current.map((currentMentor, mentorIndex) =>
          mentorIndex === index
            ? {
                ...(editBaselines.current[mentorId] ?? currentMentor),
                isEditing: false,
              }
            : currentMentor
        )
      );
    }
    if (mentor.id) delete editBaselines.current[mentor.id];
    setCardErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const saveCard = async (index: number) => {
    const mentor = mentors[index];
    if (!mentor.full_name.trim()) {
      setCardErrors((current) => ({
        ...current,
        [index]: "Mentor name is required.",
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
      const saved = await saveAdminMentorAction(mentor);
      onChange((current) =>
        current.map((currentMentor, mentorIndex) =>
          mentorIndex === index
            ? {
                id: saved.id,
                isEditing: false,
                full_name: saved.full_name,
                position: saved.position ?? "",
                linkedin_url: saved.linkedin_url ?? "",
                description: saved.description ?? "",
                profile_image_path: saved.profile_image_path ?? "",
              }
            : currentMentor
        )
      );
      if (mentor.id) delete editBaselines.current[mentor.id];
      router.refresh();
    } catch (error) {
      setCardErrors((current) => ({
        ...current,
        [index]:
          error instanceof Error ? error.message : "Failed to save mentor.",
      }));
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <FieldSet className="gap-4">
      <div className="flex items-center justify-between gap-4">
        <FieldLegend>Mentors</FieldLegend>
        <div className="flex items-center gap-2">
          <Switch
            id="mentors_enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <FieldLabel htmlFor="mentors_enabled">Enabled</FieldLabel>
        </div>
      </div>
      {enabled && (
        <FieldGroup className="gap-5">
          {mentors.map((mentor, index) => (
            <div
              key={mentor.id ?? `new-mentor-${index}`}
              className="relative grid gap-5 rounded-xl border bg-card p-5 lg:grid-cols-[1fr_1fr_0.8fr]"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                aria-label={`Remove mentor ${index + 1}`}
                onClick={() =>
                  onChange((current) =>
                    current.filter((_, mentorIndex) => mentorIndex !== index)
                  )
                }
              >
                <X />
              </Button>
              {mentor.id && mentor.isEditing && (
                <p
                  className="col-span-full flex items-center gap-2 pr-8 text-small text-amber-700 dark:text-amber-400"
                  role="note"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  This is a shared mentor. Changes will appear on every event
                  using this mentor.
                </p>
              )}
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel>Use Existing Mentor</FieldLabel>
                  <Select
                    value={mentor.id}
                    onValueChange={(id) => chooseExisting(index, id)}
                    disabled={!mentor.isEditing || Boolean(mentor.id)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Create new mentor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {options.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.full_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`mentor_name_${index}`}>
                    Full Name
                  </FieldLabel>
                  <Input
                    id={`mentor_name_${index}`}
                    value={mentor.full_name}
                    readOnly={!mentor.isEditing}
                    onChange={(event) =>
                      update(index, "full_name", event.target.value)
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`mentor_position_${index}`}>
                    Position
                  </FieldLabel>
                  <Input
                    id={`mentor_position_${index}`}
                    value={mentor.position}
                    readOnly={!mentor.isEditing}
                    onChange={(event) =>
                      update(index, "position", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`mentor_linkedin_${index}`}>
                    LinkedIn URL
                  </FieldLabel>
                  <Input
                    id={`mentor_linkedin_${index}`}
                    type="url"
                    value={mentor.linkedin_url}
                    readOnly={!mentor.isEditing}
                    onChange={(event) =>
                      update(index, "linkedin_url", event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
              <Field>
                <FieldLabel htmlFor={`mentor_description_${index}`}>
                  Description
                </FieldLabel>
                <Textarea
                  id={`mentor_description_${index}`}
                  className="min-h-40"
                  value={mentor.description}
                  readOnly={!mentor.isEditing}
                  onChange={(event) =>
                    update(index, "description", event.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Profile Image</FieldLabel>
                <div className="flex min-h-40 items-center justify-center rounded-lg bg-muted p-4">
                  <Button type="button" variant="outline" disabled>
                    Upload coming later
                  </Button>
                </div>
              </Field>
              <div className="col-span-full flex items-center justify-end gap-2">
                {cardErrors[index] && (
                  <FieldError className="mr-auto">
                    {cardErrors[index]}
                  </FieldError>
                )}
                {mentor.isEditing ? (
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
                    aria-label={`Edit mentor ${mentor.full_name}`}
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
            className="min-h-20 w-full"
            onClick={() =>
              onChange((current) => [...current, blankMentor()])
            }
          >
            <Plus data-icon="inline-start" />
            Add Mentor
          </Button>
        </FieldGroup>
      )}
    </FieldSet>
  );
}
