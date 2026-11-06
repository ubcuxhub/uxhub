"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

import { RecordField } from "@/components/shared/RecordDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { normalizeInterests } from "../lib/user-profile";

interface UserInterestsFieldProps {
  /** The saved interests, shown while viewing. */
  value: string[];
  /** The draft interests and the tag being typed, while editing. */
  draft?: { interests: string[]; newInterest: string };
  disabled?: boolean;
  onChange?: (changes: { interests?: string[]; newInterest?: string }) => void;
}

/**
 * Interests as tags. While editing, tags can be removed and added; a tag
 * still in the box when the record is saved is added too.
 */
export function UserInterestsField({ value, draft, disabled, onChange }: UserInterestsFieldProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!draft?.newInterest.trim()) return;
    try {
      onChange?.({ interests: normalizeInterests([...draft.interests, draft.newInterest]), newInterest: "" });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add interest.");
    }
  };

  return (
    <RecordField
      label="Interests"
      htmlFor={inputId}
      value={value.length ? <Tags tags={value} /> : null}
      description={draft ? "Up to 20 tags, 50 characters each." : undefined}
      error={error}
    >
      {draft ? (
        <div className="flex flex-col gap-3">
          {draft.interests.length ? (
            <Tags
              tags={draft.interests}
              renderRemove={(tag) => (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove interest ${tag}`}
                  className="-mr-1 cursor-pointer rounded-full p-0.5 hover:bg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onChange?.({ interests: draft.interests.filter((item) => item !== tag) })}
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            />
          ) : null}
          <div className="flex gap-2">
            <Input
              id={inputId}
              value={draft.newInterest}
              maxLength={50}
              disabled={disabled}
              placeholder="Add an interest"
              onChange={(event) => {
                onChange?.({ newInterest: event.target.value });
                setError(null);
              }}
              onKeyDown={(event) => {
                // Enter adds the tag instead of saving the record.
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Button type="button" variant="secondary" disabled={disabled} onClick={add}>
              <Plus aria-hidden />
              Add
            </Button>
          </div>
        </div>
      ) : undefined}
    </RecordField>
  );
}

function Tags({ tags, renderRemove }: { tags: string[]; renderRemove?: (tag: string) => ReactNode }) {
  return (
    <ul aria-label="Interests" className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag} className="max-w-full">
          <Badge variant="tag" size="large" className="max-w-full">
            <span className="min-w-0 break-words whitespace-normal">{tag}</span>
            {renderRemove?.(tag)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
