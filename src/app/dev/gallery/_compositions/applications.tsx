"use client";

import { useId, useState } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

import { BackButton } from "@/components/shared/BackButton";
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
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApplicantInfoCard } from "@/features/admin/components/ApplicantInfoCard";
import { ApplicantPager } from "@/features/admin/components/ApplicantPager";
import { ApplicationResponseCard } from "@/features/admin/components/ApplicationResponseCard";
import { ReviewStateBadge } from "@/features/admin/components/ReviewStateBadge";
import { StatusUpdateSection } from "@/features/admin/components/StatusUpdateSection";
import {
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import {
  ReviewerNotes,
  type ReviewerNote,
} from "@/features/applications/components/ReviewerNotes";
import { formatEventDate } from "@/lib/date";

import { HERE } from "../_fixtures";
import {
  APPLICANTS,
  FEATURED_APPLICANT,
  REVIEWER,
  REVIEW_NOTES,
  REVIEW_NOW,
} from "../_review-fixtures";

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

/** A thread that really edits: fixture notes in local state, with a short wait. */
function useLocalNotes(initial: readonly ReviewerNote[]) {
  const [notes, setNotes] = useState<ReviewerNote[]>([...initial]);
  const wait = () => new Promise((resolve) => setTimeout(resolve, 450));
  return {
    notes,
    onAdd: async (body: string) => {
      await wait();
      setNotes((current) => [
        ...current,
        {
          id: `note-${current.length + 1}-${body.length}`,
          body,
          createdAt: REVIEW_NOW.toISOString(),
          author: REVIEWER,
        },
      ]);
    },
    onEdit: async (id: string, body: string) => {
      await wait();
      setNotes((current) =>
        current.map((note) =>
          note.id === id ? { ...note, body, editedAt: REVIEW_NOW.toISOString() } : note,
        ),
      );
    },
    onDelete: async (id: string) => {
      await wait();
      setNotes((current) => current.filter((note) => note.id !== id));
    },
  };
}

const PANEL = `border-border-subtle ${LIFT}`;

function Notes() {
  const thread = useLocalNotes(REVIEW_NOTES);
  return (
    <ReviewerNotes
      {...thread}
      currentUserId={REVIEWER.id}
      now={REVIEW_NOW}
      className={PANEL}
    />
  );
}

type NotesState = "empty" | "loading" | "error";

function NotesStates() {
  const [state, setState] = useState<NotesState>("empty");
  const [attempt, setAttempt] = useState(0);
  const thread = useLocalNotes([]);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedToggle
        aria-label="Reviewer notes state"
        value={state}
        onValueChange={(value) => setState(value as NotesState)}
        className="w-full"
      >
        <SegmentedToggleItem value="empty">Empty</SegmentedToggleItem>
        <SegmentedToggleItem value="loading">Loading</SegmentedToggleItem>
        <SegmentedToggleItem value="error">Load failed</SegmentedToggleItem>
      </SegmentedToggle>
      <ReviewerNotes
        key={`${state}-${attempt}`}
        {...thread}
        notes={state === "empty" ? thread.notes : []}
        status={state === "empty" ? "ready" : state}
        onRetry={() => {
          setState("loading");
          setAttempt((n) => n + 1);
        }}
        currentUserId={REVIEWER.id}
        now={REVIEW_NOW}
        className={PANEL}
      />
    </div>
  );
}

/**
 * The application page's header at phone width: back to the list, who, and
 * previous and next through the list the reviewer came from.
 */
function ApplicantHeader() {
  const queue = APPLICANTS.filter((applicant) => applicant.state === "submitted");
  const [index, setIndex] = useState(() =>
    queue.findIndex((applicant) => applicant.id === FEATURED_APPLICANT.id),
  );
  const applicant = queue[index];
  const target = (at: number) => (queue[at] ? { href: HERE, name: queue[at].name } : null);
  return (
    <Panel>
      <CardContent className="flex flex-col gap-5">
        <BackButton link={HERE} label="Back to applications" />
        <div className="flex items-center gap-3">
          <Avatar name={applicant.name} src={applicant.avatarUrl} size={56} decorative />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <h3 className="max-w-full truncate text-h3">{applicant.name}</h3>
            <ReviewStateBadge state={applicant.state} />
          </div>
        </div>
        <p className="text-small text-muted-foreground">
          {applicant.program} · Submitted{" "}
          {formatEventDate(applicant.submittedAt, { month: "short", year: undefined })}
        </p>
        <ApplicantPager
          position={index + 1}
          total={queue.length}
          scope="Submitted"
          previous={target(index - 1)}
          next={target(index + 1)}
          onNavigate={(event, direction) => {
            event.preventDefault();
            setIndex((at) => at + (direction === "next" ? 1 : -1));
          }}
          className="justify-between border-t border-border-subtle pt-4"
        />
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
  "reviewer-notes": Notes,
  "reviewer-notes-states": NotesStates,
  "applicant-header": ApplicantHeader,
  "application-decision": Decision,
  "alerts": Alerts,
  "application-form": ApplicationForm,
} satisfies Components;
