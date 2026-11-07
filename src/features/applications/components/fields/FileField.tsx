"use client";

import { useId, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, joinIds } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { applicationFileName } from "@/lib/application-response";
import { validateApplicationFile } from "@/lib/supabase-helpers/application-files";
import { cn } from "@/lib/utils";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/** "240 KB", "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface FileFieldProps extends Omit<QuestionFieldProps<string>, "onChange"> {
  /** Uploads and saves the file; resolves to an error message, or null. */
  onUpload: (file: File) => Promise<string | null>;
  /** Removes the file and clears the answer; resolves to an error message, or null. */
  onRemove: () => Promise<string | null>;
  /** The uploaded file's size, when this session uploaded it. */
  fileSize?: number;
}

/**
 * A `file_upload` question. The bucket takes one PDF up to 5 MB, whatever the
 * question's own file settings say, so that is what the hint promises. The
 * answer is the storage key; the field shows its file name with Remove.
 *
 * The drop zone is a label around a visually hidden file input, so a click,
 * Enter or Space on the focused input, or a drop all pick a file.
 */
export function FileField({
  question,
  number,
  value,
  error,
  disabled,
  onUpload,
  onRemove,
  fileSize,
}: FileFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const shownError = localError ?? error;
  const locked = Boolean(disabled) || busy !== null;
  const fileName = applicationFileName(value);

  const upload = async (file: File) => {
    const invalid = validateApplicationFile(file);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setLocalError(null);
    setBusy("uploading");
    try {
      setLocalError(await onUpload(file));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setLocalError(null);
    setBusy("removing");
    try {
      setLocalError(await onRemove());
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !locked) void upload(file);
  };

  return (
    <Field id={questionAnchorId(question.id)} className="gap-4">
      <FieldLabel htmlFor={value ? undefined : id}>
        <QuestionText number={number} question={question} />
      </FieldLabel>
      {question.description ? (
        <FieldDescription className="-mt-2">{question.description}</FieldDescription>
      ) : null}

      {value ? (
        <div
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-lg border border-transparent bg-section px-4 py-2",
            shownError && "border-destructive"
          )}
        >
          <p className="min-w-0 flex-1 truncate text-small text-foreground">
            {fileName}
            {fileSize ? (
              <span className="text-muted-foreground"> · {formatFileSize(fileSize)}</span>
            ) : null}
          </p>
          {disabled ? null : (
            <Button
              type="button"
              variant="link"
              size="sm"
              loading={busy === "removing"}
              disabled={locked}
              onClick={() => void remove()}
              aria-label={`Remove ${fileName}`}
            >
              Remove
            </Button>
          )}
        </div>
      ) : (
        <label
          data-slot="file-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => !locked && setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-section p-6 text-center transition-colors duration-150",
            locked
              ? "cursor-not-allowed"
              : "cursor-pointer hover:bg-muted has-[:focus-visible]:focus-ring",
            dragging && "border-primary bg-info",
            shownError && "border-destructive"
          )}
        >
          <input
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={locked}
            aria-describedby={joinIds(hintId, shownError ? errorId : undefined)}
            aria-invalid={shownError ? true : undefined}
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              // Picking the same file again after an error must fire `change` again.
              input.value = "";
              if (file) void upload(file);
            }}
          />
          {busy === "uploading" ? (
            <Spinner size="sm" />
          ) : (
            <Upload
              aria-hidden
              className={cn("size-4", disabled ? "text-disabled-foreground" : "text-muted-foreground")}
            />
          )}
          <span
            className={cn("text-body-medium", disabled && "text-disabled-foreground")}
          >
            {busy === "uploading" ? "Uploading…" : dragging ? "Drop to upload" : "Upload a file"}
          </span>
          <span id={hintId} className="text-small text-muted-foreground">
            PDF, up to 5 MB
          </span>
        </label>
      )}

      <FieldError id={errorId} className="-mt-2">
        {shownError}
      </FieldError>
    </Field>
  );
}
