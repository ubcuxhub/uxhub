"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Ellipsis, MessageSquareText, Pencil, Trash2, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  pacificDate,
} from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Reviewer notes: a comment thread on one application, so admins reviewing it
 * can share what they noticed (docs/design/application-review.md). Only admins
 * see it; applicants never do.
 *
 * Presentational: the page owns the data and passes async handlers. A handler
 * that throws keeps the text and shows an error beside it, so nothing typed is
 * lost. Everyone reads every note; only a note's author can edit or delete it,
 * and a deleted account's notes stay, shown as "Deleted user".
 */

export interface ReviewerNoteAuthor {
  id: string;
  /** Full name. Ignored when `deleted`. */
  name: string;
  avatarUrl?: string | null;
  /** The account was deleted (`user_info.deleted_at` is set). */
  deleted?: boolean;
}

export interface ReviewerNote {
  id: string;
  body: string;
  createdAt: string;
  /** Set when the body last changed after posting; `null` if never edited. */
  editedAt?: string | null;
  author: ReviewerNoteAuthor;
}

export type ReviewerNotesStatus = "ready" | "loading" | "error";

export interface ReviewerNotesProps {
  /** Oldest first, the order they were posted. */
  notes: readonly ReviewerNote[];
  /** `loading` shows skeleton rows; `error` a retry in place of the thread. */
  status?: ReviewerNotesStatus;
  /** The signed-in admin: their notes get Edit and Delete. */
  currentUserId: string;
  onAdd: (body: string) => Promise<void> | void;
  onEdit: (id: string, body: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  /** Reloads after a failed load. */
  onRetry?: () => void;
  /** The heading's level on its page. Default 2. */
  headingLevel?: 2 | 3;
  /** Pins "now" for relative times (gallery, tests). Defaults to the live clock. */
  now?: Date;
  className?: string;
}

/** Longest note, in characters. The database should check the same. */
export const NOTE_MAX_LENGTH = 2000;
export const DELETED_USER = "Deleted user";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const POST_ERROR = "Couldn’t post your note. Check your connection and try again.";
const SAVE_ERROR = "Couldn’t save your changes. Check your connection and try again.";
const DELETE_ERROR = "Couldn’t delete your note. Check your connection and try again.";

/**
 * When a note was posted, in words, relative to `now` (ms): "Just now",
 * "12 min ago", "3 hr ago" (same Pacific day), "Yesterday at 4:05 PM",
 * "Nov 2 at 9:30 AM", or "Nov 2, 2025" in an earlier year.
 */
export function formatNoteTime(value: string, now: number): string {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return value;
  const ago = now - instant;
  if (ago < MINUTE) return "Just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;

  const day = pacificDate(value);
  const time = formatEventTime(value);
  if (day === pacificDate(new Date(now).toISOString())) {
    return `${Math.floor(ago / HOUR)} hr ago`;
  }
  if (day === pacificDate(new Date(now - DAY).toISOString())) {
    return `Yesterday at ${time}`;
  }
  if (day.slice(0, 4) === pacificDate(new Date(now).toISOString()).slice(0, 4)) {
    return `${formatEventDate(value, { month: "short", year: undefined })} at ${time}`;
  }
  return formatEventDate(value, { month: "short" }) ?? value;
}

// --- The clock -------------------------------------------------------------

function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, 30 * 1000);
  return () => clearInterval(timer);
}
const readClock = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const readServerClock = () => null;

/**
 * The current minute, ticking so "Just now" ages. `null` on the server and
 * while hydrating, where times show in full instead.
 */
function useMinute(pinned?: Date): number | null {
  const live = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  return pinned ? pinned.getTime() : live;
}

function NoteTime({ value, now }: { value: string; now: number | null }) {
  const full = formatTimestamp(value) ?? value;
  return (
    <time dateTime={value} title={full}>
      {now === null ? full : formatNoteTime(value, now)}
    </time>
  );
}

// --- Thread ---------------------------------------------------------------

export function ReviewerNotes({
  notes,
  status = "ready",
  currentUserId,
  onAdd,
  onEdit,
  onDelete,
  onRetry,
  headingLevel = 2,
  now: pinnedNow,
  className,
}: ReviewerNotesProps) {
  const headingId = useId();
  const now = useMinute(pinnedNow);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [announcement, setAnnouncement] = useState("");

  const count =
    status === "ready"
      ? `${notes.length} ${notes.length === 1 ? "note" : "notes"} · `
      : "";

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      data-slot="reviewer-notes"
      className={className}
    >
      <CardHeader>
        <CardTitle id={headingId} role="heading" aria-level={headingLevel}>
          Reviewer notes
        </CardTitle>
        <CardDescription>{count}Only admins see these</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {status === "loading" ? (
          <NotesSkeleton />
        ) : status === "error" ? (
          <EmptyState
            size="inline"
            titleAs="p"
            title="Couldn’t load notes"
            description="Check your connection, then try again."
            actions={
              onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {notes.length === 0 ? (
              <EmptyState
                size="inline"
                titleAs="p"
                className="py-2"
                title="No notes yet"
                description="Share what stood out, so other reviewers can weigh in."
              />
            ) : (
              <ol aria-labelledby={headingId} className="flex flex-col gap-5">
                {notes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    mine={!note.author.deleted && note.author.id === currentUserId}
                    now={now}
                    onEdit={async (body) => {
                      await onEdit(note.id, body);
                      setAnnouncement("Note saved");
                    }}
                    onDelete={async () => {
                      await onDelete(note.id);
                      setAnnouncement("Note deleted");
                      // The note and its menu are gone: land in the composer.
                      composerRef.current?.focus();
                    }}
                  />
                ))}
              </ol>
            )}
            <Separator className="bg-border-subtle" />
            <NoteComposer
              textareaRef={composerRef}
              onPost={async (body) => {
                await onAdd(body);
                setAnnouncement("Note posted");
              }}
            />
          </>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </CardContent>
    </Card>
  );
}

function NotesSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-5">
      <span className="sr-only">Loading notes</span>
      {["w-24", "w-32", "w-20"].map((width) => (
        <div key={width} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className={cn("h-3.5 rounded-full", width)} />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-3/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- One note ---------------------------------------------------------------

function NoteItem({
  note,
  mine,
  now,
  onEdit,
  onDelete,
}: {
  note: ReviewerNote;
  mine: boolean;
  now: number | null;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const deleted = Boolean(note.author.deleted);
  const name = deleted ? DELETED_USER : note.author.name;

  return (
    <li className="flex gap-3">
      <Avatar
        name={name}
        src={deleted ? null : note.author.avatarUrl}
        anonymous={deleted}
        size={32}
        decorative
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-small text-muted-foreground">
            <span
              className={cn("font-medium", deleted ? "text-muted-foreground" : "text-foreground")}
            >
              {name}
            </span>
            {mine ? " (you)" : null}
            {" · "}
            <NoteTime value={note.createdAt} now={now} />
            {note.editedAt ? (
              <span title={`Edited ${formatTimestamp(note.editedAt) ?? note.editedAt}`}>
                {" · Edited"}
              </span>
            ) : null}
          </p>
          {mine && !editing ? (
            <NoteActions
              triggerRef={triggerRef}
              onEdit={() => setEditing(true)}
              onDelete={onDelete}
            />
          ) : null}
        </div>
        {editing ? (
          <NoteEditor
            initial={note.body}
            onCancel={() => {
              setEditing(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
            onSave={async (body) => {
              await onEdit(body);
              setEditing(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
          />
        ) : (
          <NoteBody text={note.body} />
        )}
      </div>
    </li>
  );
}

/** Long notes start cut at six lines, fading out, with "Show more" to read the rest. */
function NoteBody({ text }: { text: string }) {
  const bodyId = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded || typeof ResizeObserver === "undefined") return;
    // Fires once on observe, then on every resize.
    const observer = new ResizeObserver(() =>
      setClamped(element.scrollHeight > element.clientHeight + 1),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        ref={ref}
        id={bodyId}
        className={cn(
          "w-full text-small whitespace-pre-wrap break-words text-foreground",
          // Six 20px lines. Not `line-clamp`: its ellipsis lands alone on a blank line.
          !expanded && "max-h-30 overflow-hidden",
          clamped && !expanded && "[mask-image:linear-gradient(to_bottom,black_65%,transparent)]",
        )}
      >
        {text}
      </p>
      {clamped || expanded ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}

function NoteActions({
  triggerRef,
  onEdit,
  onDelete,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={triggerRef}
            variant="ghost"
            size="icon-sm"
            label="Edit or delete your note"
            className="-my-1.5 -mr-1.5"
          >
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // The editor and the dialog each take focus themselves.
            event.preventDefault();
          }}
        >
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            Edit note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden />
            Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
        returnFocusRef={triggerRef}
        icon={<TriangleAlert aria-hidden />}
        title="Delete your note?"
        description="Other reviewers won’t see it any more. You can’t undo this."
        cancelLabel="Keep note"
        confirmLabel="Delete note"
        pendingLabel="Deleting…"
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(null);
          try {
            await onDelete();
            setConfirming(false);
          } catch {
            setError(DELETE_ERROR);
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}

// --- Writing ----------------------------------------------------------------

/** Cmd+Enter or Ctrl+Enter sends; plain Enter is a new line. */
function isSubmitShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

function useSubmit(send: (body: string) => Promise<void>, failure: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (body: string) => {
    const text = body.trim();
    if (!text || pending) return false;
    setPending(true);
    setError(null);
    try {
      await send(text);
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setPending(false);
    }
  };
  return { pending, error, submit };
}

function NoteComposer({
  textareaRef,
  onPost,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onPost: (body: string) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const { pending, error, submit } = useSubmit(onPost, POST_ERROR);

  const post = async (event?: FormEvent) => {
    event?.preventDefault();
    if (await submit(draft)) setDraft("");
  };

  return (
    <form onSubmit={post} className="flex flex-col gap-3">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Add a note</FieldLabel>
        <Textarea
          ref={textareaRef}
          id={id}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          showCount
          value={draft}
          readOnly={pending}
          placeholder="What stood out? Strengths, concerns, a team they’d suit"
          aria-keyshortcuts="Meta+Enter Control+Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (isSubmitShortcut(event)) void post(event);
          }}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <div className="flex items-center justify-end gap-3">
        <p className="mr-auto text-label font-normal text-muted-foreground pointer-coarse:hidden">
          <kbd className="font-sans">Ctrl</kbd> or <kbd className="font-sans">⌘</kbd> + Enter to post
        </p>
        {/* Secondary: the page's one primary button is the decision (§3.1). */}
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={pending}
          disabled={!draft.trim()}
        >
          <MessageSquareText aria-hidden />
          {pending ? "Posting…" : "Post note"}
        </Button>
      </div>
    </form>
  );
}

function NoteEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<void>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(initial);
  const { pending, error, submit } = useSubmit(onSave, SAVE_ERROR);
  const unchanged = draft.trim() === initial.trim();

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (unchanged) return onCancel();
    await submit(draft);
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <Field data-invalid={error ? true : undefined}>
        <Textarea
          ref={ref}
          aria-label="Edit your note"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          showCount
          value={draft}
          readOnly={pending}
          aria-keyshortcuts="Meta+Enter Control+Enter Escape"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (isSubmitShortcut(event)) void save(event);
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={pending}
          disabled={!draft.trim()}
        >
          {pending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </form>
  );
}
