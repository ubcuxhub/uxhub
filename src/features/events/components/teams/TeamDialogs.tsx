"use client";

import { useId, useState, useTransition } from "react";
import { Info, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useUser } from "@/lib/auth/user-context";

import {
  createTeamAction,
  deleteTeamAction,
  joinTeamAction,
  leaveTeamAction,
  previewTeamAction,
  renameTeamAction,
} from "../../team-actions";
import { TEAM_NAME_MAX_LENGTH, TEAM_UNEXPECTED_ERROR } from "../../lib/teams";
import { inviteDescription, joinedDescription, type TeamInvite, type TeamView } from "../../lib/team-view";
import { InviteLinkField, TeamMemberRow } from "./TeamParts";

/** Every team dialog is 480px wide in Figma, with 20px padding. */
const DIALOG_CLASS = "sm:max-w-120 sm:p-5";

/**
 * Runs a team action. The actions report their own refusals; this catches
 * the call itself failing, such as a dropped connection, so the dialog can
 * say so instead of throwing.
 */
async function call<T extends { ok: boolean }>(
  action: () => Promise<T>
): Promise<T | { ok: false; error: string }> {
  try {
    return await action();
  } catch {
    return { ok: false, error: TEAM_UNEXPECTED_ERROR };
  }
}

// ── Create a team / Rename team (7.1) ──────────────────────────────────────

interface TeamNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create a team for this event, or rename this team. */
  target: { kind: "create"; eventId: string } | { kind: "rename"; team: TeamView };
  /** After a team is created, so the card can show its invite link (7.2). */
  onCreated?: () => void;
}

export function TeamNameDialog({ open, onOpenChange, target, onCreated }: TeamNameDialogProps) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className={DIALOG_CLASS} closeDisabled={pending} aria-describedby={undefined}>
        {/* Unmounted while closed, so the field starts over on every open. */}
        <TeamNameForm
          target={target}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onSubmit={(name, setError) =>
            startTransition(async () => {
              const result =
                target.kind === "create"
                  ? await call(() => createTeamAction({ eventId: target.eventId, name }))
                  : await call(() => renameTeamAction({ teamId: target.team.id, name }));
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onOpenChange(false);
              if (target.kind === "create") onCreated?.();
              else toast.success("Team renamed");
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function TeamNameForm({
  target,
  pending,
  onCancel,
  onSubmit,
}: {
  target: TeamNameDialogProps["target"];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, setError: (error: string) => void) => void;
}) {
  const inputId = useId();
  const { user } = useUser();
  const [name, setName] = useState(target.kind === "rename" ? (target.team.name ?? "") : "");
  // What the team is called if it's saved unnamed (see `teamDisplayName`).
  // Only the owner names a team, so it's the signed-in student's name.
  const firstName = user?.first_name?.trim();
  const unnamed = firstName ? `${firstName}'s team` : "Your team";
  const [error, setError] = useState<string | null>(null);
  const creating = target.kind === "create";

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        onSubmit(name, setError);
      }}
    >
      <DialogHeader>
        <DialogTitle>{creating ? "Create a team" : "Rename team"}</DialogTitle>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={inputId}>Team name</FieldLabel>
        {/* Not focused on open: the dialog takes focus instead, so the field
            doesn't start with a focus ring. */}
        <Input
          id={inputId}
          value={name}
          maxLength={TEAM_NAME_MAX_LENGTH}
          placeholder={unnamed}
          autoComplete="off"
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {creating ? "Create team" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Your team is ready (7.2) ───────────────────────────────────────────────

export function TeamReadyDialog({
  open,
  onOpenChange,
  team,
  maxTeamSize,
  inviteUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamView;
  maxTeamSize: number | null;
  inviteUrl: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader className="space-y-0.5">
          <DialogTitle>Your team is ready</DialogTitle>
          <DialogDescription>
            {maxTeamSize === null
              ? `Anyone with this link can join ${team.displayName}.`
              : `Anyone with this link can join ${team.displayName} until your team has ${maxTeamSize} members.`}
          </DialogDescription>
        </DialogHeader>
        <InviteLinkField url={inviteUrl} />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Join a team (link step, then 7.5) ──────────────────────────────────────

interface JoinTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /**
   * The team from an invite link the student opened. The dialog starts on the
   * "Join [team]?" step; without it, the student pastes a link first.
   */
  invite: TeamInvite | null;
}

export function JoinTeamDialog({ open, onOpenChange, eventId, invite }: JoinTeamDialogProps) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className={DIALOG_CLASS} closeDisabled={pending}>
        <JoinTeamSteps
          eventId={eventId}
          initialInvite={invite}
          pending={pending}
          startTransition={startTransition}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function JoinTeamSteps({
  eventId,
  initialInvite,
  pending,
  startTransition,
  onClose,
}: {
  eventId: string;
  initialInvite: TeamInvite | null;
  pending: boolean;
  startTransition: ReturnType<typeof useTransition>[1];
  onClose: () => void;
}) {
  const inputId = useId();
  const [invite, setInvite] = useState<TeamInvite | null>(initialInvite);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!invite) {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await call(() => previewTeamAction({ eventId, link }));
            if (result.ok) setInvite(result.invite);
            else setError(result.error);
          });
        }}
      >
        <DialogHeader className="space-y-0.5">
          <DialogTitle>Join a team</DialogTitle>
          <DialogDescription>Paste the invite link a teammate shared with you.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={inputId}>Invite link</FieldLabel>
          <Input
            id={inputId}
            data-autofocus=""
            value={link}
            placeholder="ubcuxhub.ca/join/…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={pending}
            onChange={(event) => setLink(event.target.value)}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!link.trim()}>
            Continue
          </Button>
        </DialogFooter>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <DialogHeader className="space-y-0.5">
        <DialogTitle>Join {invite.teamName}?</DialogTitle>
        <DialogDescription>{inviteDescription(invite)}</DialogDescription>
      </DialogHeader>
      <ul aria-label={`${invite.teamName} members`}>
        {invite.members.map((member, index) => (
          <TeamMemberRow
            key={index}
            name={member.name}
            label={member.isOwner ? "Owner" : null}
            compact
          />
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            onClose();
            toast.info("Invite declined", {
              description: `You didn't join ${invite.teamName}. You can still create your own team or use another invite link.`,
            });
          }}
        >
          No, thanks
        </Button>
        <Button
          type="button"
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await call(() => joinTeamAction({ inviteCode: invite.inviteCode }));
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onClose();
              toast.success(`You joined ${invite.teamName}`, {
                description: joinedDescription(invite),
              });
            });
          }}
        >
          Join team
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Delete team (7.4) and Leave team (7.9) ─────────────────────────────────

/** The consequences box in the delete and leave dialogs. */
function Consequences({ items }: { items: { title: string; body?: string; info?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-4 rounded-lg bg-warning p-4">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-3">
          <span className="pt-0.5 text-warning-foreground" aria-hidden>
            {item.info ? <Info className="size-4" /> : <TriangleAlert className="size-4" />}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 text-small text-foreground">
            <p className="font-semibold">{item.title}</p>
            {item.body ? <p>{item.body}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface TeamConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamView;
  /** The menu trigger, since the menu item that opened the dialog is gone. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

export function DeleteTeamDialog({ open, onOpenChange, team, returnFocusRef }: TeamConfirmProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        onOpenChange(next);
      }}
      returnFocusRef={returnFocusRef}
      title={`Delete ${team.displayName}?`}
      confirmLabel="Delete team"
      cancelLabel="Keep team"
      pending={pending}
      error={error}
      onConfirm={() =>
        startTransition(async () => {
          const result = await call(() => deleteTeamAction({ teamId: team.id }));
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onOpenChange(false);
          toast.success(`Deleted ${team.displayName}`);
        })
      }
    >
      <Consequences
        items={[
          { title: "Everyone is removed, including you" },
          { title: "The invite link stops working" },
          {
            title: "You can still team up",
            body: "You can create a new team, or join someone else’s team with their invite link.",
            info: true,
          },
        ]}
      />
    </ConfirmDialog>
  );
}

export function LeaveTeamDialog({
  open,
  onOpenChange,
  team,
  eventId,
  returnFocusRef,
}: TeamConfirmProps & { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        onOpenChange(next);
      }}
      returnFocusRef={returnFocusRef}
      title={`Leave ${team.displayName}?`}
      confirmLabel="Leave team"
      cancelLabel="Stay on team"
      pending={pending}
      error={error}
      onConfirm={() =>
        startTransition(async () => {
          const result = await call(() => leaveTeamAction({ eventId }));
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onOpenChange(false);
          toast.success(`You left ${team.displayName}`);
        })
      }
    >
      <Consequences
        items={[
          {
            title: "You'll be removed from the team",
            body: "The rest of the team stays together.",
          },
        ]}
      />
    </ConfirmDialog>
  );
}
