"use client";

import { useId, useRef, useState } from "react";
import { CircleAlert, Ellipsis, Info, Pencil, Trash2, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CardAction,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { YearSelectOptions } from "@/app/dev/components/_demos/_fixtures/year-select";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApplicantInfoCard } from "@/features/admin/components/ApplicantInfoCard";
import { ApplicationResponseCard } from "@/features/admin/components/ApplicationResponseCard";
import { StatusUpdateSection } from "@/features/admin/components/StatusUpdateSection";
import {
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";

import { LIFT, Panel } from "./frame";
import type { Components } from "./types";

function Applicant() {
  return (
    <div className={`rounded-xl ${LIFT} [&>[data-slot=card]]:border-border-subtle`}>
      <ApplicantInfoCard
        name="Priya Raman"
        email="priya.raman@student.ubc.ca"
        applicationDate="2026-10-28T19:42:00Z"
        state="accepted"
        offerExpiresAt="2026-11-14T23:59:00-08:00"
      />
    </div>
  );
}

function Response() {
  return (
    <div className={`rounded-xl ${LIFT} [&>[data-slot=card]]:border-border-subtle`}>
      <ApplicationResponseCard
        question="Why do you want to join UXathon?"
        response={
          "I ran usability tests for our faculty’s course planner last term and want to try the whole loop, research to prototype, in one weekend.\n\nI’d love a team that includes a developer."
        }
      />
    </div>
  );
}

interface Note {
  id: number;
  author: string;
  src?: string;
  when: string;
  text: string;
  mine: boolean;
}

const NOTES: Note[] = [
  {
    id: 1,
    author: "Jordan Lee",
    src: "/people/elaine.jpg",
    when: "Yesterday",
    text: "Strong research portfolio. The course planner case study is thorough.",
    mine: false,
  },
  {
    id: 2,
    author: "You",
    when: "2 hours ago",
    text: "Agree. Leaning accept; let’s pair her with a developer-heavy team.",
    mine: true,
  },
];

function NoteActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton ref={triggerRef} variant="ghost" size="icon-sm" label="Note actions">
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            if (confirming) event.preventDefault();
          }}
        >
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            Edit note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          setConfirming(next);
          if (!next) setTimeout(() => triggerRef.current?.focus(), 0);
        }}
        icon={<TriangleAlert aria-hidden />}
        title="Delete this note?"
        description="Other reviewers won’t see it any more. This can’t be undone."
        cancelLabel="Keep note"
        confirmLabel="Delete note"
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
      />
    </>
  );
}

function ReviewerNotes() {
  const uid = useId();
  const [notes, setNotes] = useState(NOTES);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((current) =>
      editing === null
        ? [...current, { id: Date.now(), author: "You", when: "Just now", text, mine: true }]
        : current.map((note) => (note.id === editing ? { ...note, text } : note)),
    );
    setDraft("");
    setEditing(null);
  };

  return (
    <Panel>
      <CardHeader>
        <CardTitle>Reviewer notes</CardTitle>
        <CardDescription>
          {notes.length} {notes.length === 1 ? "note" : "notes"} · only admins see these
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <Avatar name={note.author === "You" ? "Alex Chen" : note.author} src={note.src} size={32} decorative />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-small font-semibold">{note.author}</span>
                  <span className="text-label font-normal text-muted-foreground">{note.when}</span>
                  {note.mine ? (
                    <div className="-my-1 ml-auto">
                      <NoteActions
                        onEdit={() => {
                          setEditing(note.id);
                          setDraft(note.text);
                        }}
                        onDelete={() =>
                          setNotes((current) => current.filter((n) => n.id !== note.id))
                        }
                      />
                    </div>
                  ) : null}
                </div>
                <p className="text-small text-pretty text-muted-foreground">{note.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Separator className="bg-border-subtle" />
        <Field>
          <FieldLabel htmlFor={`${uid}-note`}>
            {editing === null ? "Add a note" : "Edit your note"}
          </FieldLabel>
          <Textarea
            id={`${uid}-note`}
            rows={3}
            maxLength={280}
            showCount
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What stood out?"
          />
        </Field>
        <div className="flex justify-end gap-2">
          {editing !== null ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setDraft("");
              }}
            >
              Cancel
            </Button>
          ) : null}
          <Button size="sm" disabled={!draft.trim()} onClick={save}>
            {editing === null ? "Post note" : "Save note"}
          </Button>
        </div>
      </CardContent>
    </Panel>
  );
}

const DONE: Record<ApplicationDecision, string> = {
  accept: "Priya was offered a spot. She has until her deadline to register.",
  waitlist: "Priya is on the waitlist. Offer her a spot when one opens.",
  reject: "Priya’s application was rejected.",
};
const NEXT: Record<ApplicationDecision, ApplicationReviewState> = {
  accept: "accepted",
  waitlist: "waitlisted",
  reject: "rejected",
};

function Decision() {
  const [state, setState] = useState<ApplicationReviewState>("submitted");
  const [updating, setUpdating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const decide = (decision: ApplicationDecision) => {
    setUpdating(true);
    setTimeout(() => {
      setUpdating(false);
      setState(NEXT[decision]);
      setDone(DONE[decision]);
    }, 700);
  };

  return (
    // The overlay is `position: fixed`; the transform keeps it inside the card.
    <div
      className={`relative overflow-hidden rounded-xl [transform:translateZ(0)] ${LIFT} [&>[data-slot=card]]:border-border-subtle [&_.gap-4:has(>button)]:flex-wrap [&_.gap-4:has(>button)]:gap-2 [&_.gap-4>button]:px-3`}
    >
      <StatusUpdateSection
        state={state}
        isUpdating={updating}
        error={null}
        onDecision={(decision) => {
          if (decision === "reject") setRejecting(true);
          else decide(decision);
        }}
      />
      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        icon={<CircleAlert aria-hidden />}
        title="Reject Priya’s application?"
        description="She’s told by email, and the decision is final."
        cancelLabel="Keep reviewing"
        confirmLabel="Reject"
        onConfirm={() => {
          setRejecting(false);
          decide("reject");
        }}
      />
      {done ? (
        <SuccessOverlay
          message={done}
          onClose={() => {
            setDone(null);
            toast("Decision saved");
          }}
        />
      ) : null}
    </div>
  );
}

function Alerts() {
  return (
    <Panel className="gap-3 px-4 py-4">
      <Alert variant="warning" icon={<TriangleAlert />}>
        <AlertTitle>Your membership ends Apr 30</AlertTitle>
        <AlertDescription>
          Events after that date charge the non-member price.
        </AlertDescription>
      </Alert>
      <Alert variant="info" icon={<Info />}>
        <AlertTitle>Applications close Dec 1</AlertTitle>
        <AlertDescription>Decisions go out by Dec 10.</AlertDescription>
      </Alert>
      <Alert variant="destructive" icon={<CircleAlert />}>
        <AlertTitle>Payment didn’t go through</AlertTitle>
        <AlertDescription>
          Your card was declined. Try another card; you haven’t been charged.
        </AlertDescription>
      </Alert>
    </Panel>
  );
}

function ApplicationForm() {
  const uid = useId();
  const [days, setDays] = useState({ sat: true, sun: false });
  const [why, setWhy] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Apply to UXathon 2027</CardTitle>
        <CardDescription>About five minutes. Decisions by Dec 10.</CardDescription>
        {sent ? (
          <CardAction>
            <StatusBadge status="pending" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor={`${uid}-portfolio`}>Portfolio link</FieldLabel>
          <Input
            id={`${uid}-portfolio`}
            type="url"
            placeholder="https://"
            defaultValue="https://alexchen.design"
            disabled={sent}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${uid}-year`}>Year of study</FieldLabel>
          <Select defaultValue="3" disabled={sent}>
            <SelectTrigger id={`${uid}-year`}>
              <SelectValue />
            </SelectTrigger>
            <YearSelectOptions />
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${uid}-why`}>Why do you want to join?</FieldLabel>
          <Textarea
            id={`${uid}-why`}
            rows={3}
            maxLength={300}
            showCount
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            disabled={sent}
          />
        </Field>
        <FieldSet>
          <FieldLegend variant="label">Which days can you come?</FieldLegend>
          <FieldDescription>Teams work best when everyone is there both days.</FieldDescription>
          {(
            [
              ["sat", "Saturday, Jan 9"],
              ["sun", "Sunday, Jan 10"],
            ] as const
          ).map(([day, label]) => (
            <Field key={day} orientation="horizontal">
              <Checkbox
                id={`${uid}-${day}`}
                checked={days[day]}
                disabled={sent}
                onCheckedChange={(checked) => setDays((current) => ({ ...current, [day]: checked }))}
              />
              <FieldLabel htmlFor={`${uid}-${day}`} className="font-normal">
                {label}
              </FieldLabel>
            </Field>
          ))}
        </FieldSet>
        <Button
          className="w-full"
          disabled={sent || !why.trim()}
          onClick={() => {
            setSent(true);
            toast.success("Application sent", { description: "We’ll email you by Dec 10." });
          }}
        >
          {sent ? "Application sent" : "Send application"}
        </Button>
      </CardContent>
    </Panel>
  );
}

export const APPLICATION_COMPONENTS = {
  "applicant": Applicant,
  "application-response": Response,
  "reviewer-notes": ReviewerNotes,
  "application-decision": Decision,
  "alerts": Alerts,
  "application-form": ApplicationForm,
} satisfies Components;
