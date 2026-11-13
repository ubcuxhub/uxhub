"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Hubbo } from "@/components/shared/Hubbo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

import {
  formatTeamDeadline,
  inviteLinkPath,
  memberCountLabel,
  spotsLeftLabel,
} from "../../lib/teams";
import type { TeamInvite, TeamView } from "../../lib/team-view";
import {
  DeleteTeamDialog,
  JoinTeamDialog,
  LeaveTeamDialog,
  TeamNameDialog,
  TeamReadyDialog,
} from "./TeamDialogs";
import { InviteLinkField, TeamMemberRow } from "./TeamParts";

export interface TeamCardProps {
  eventId: string;
  maxTeamSize: number | null;
  teamDeadline: string | null;
  /** The deadline has passed: nobody creates, joins, leaves or deletes. */
  locked: boolean;
  /** The signed-in student's team, or null. */
  team: TeamView | null;
  /** The site's origin, for the invite link: "https://ubcuxhub.ca". */
  origin: string;
  /** The team behind an invite link the student opened (`?join=<code>`). */
  invite: TeamInvite | null;
  /** Why that invite link can't be used, when it can't. */
  inviteError: string | null;
}

/**
 * Acts on an invite link once: opens "Join [team]?" for a usable invite, or
 * toasts why it can't be used. Then clears `?join=` so a refresh doesn't
 * repeat it.
 */
function useInviteFromUrl(invite: TeamInvite | null, inviteError: string | null, openJoin: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || (!invite && !inviteError)) return;
    handled.current = true;
    if (invite) openJoin();
    else if (inviteError) toast.error("Couldn't open the invite", { description: inviteError });
    router.replace(pathname, { scroll: false });
  }, [invite, inviteError, openJoin, pathname, router]);
}

/**
 * For a student without a ticket who opened an invite link: there's no card
 * to show, only why they can't join yet.
 */
export function TeamInviteNotice({ inviteError }: { inviteError: string }) {
  useInviteFromUrl(null, inviteError, () => {});
  return null;
}

type OpenDialog = "create" | "ready" | "join" | "rename" | "delete" | "leave" | null;

/**
 * "Your team" on the portal event page, for events with teams (Figma
 * "Teams", 7.1–7.11). Shows the student's team, or the ways to get one, and
 * holds every team dialog. An invite link lands here with `?join=<code>`,
 * which opens "Join [team]?" once and is then dropped from the URL.
 */
export function TeamCard({
  eventId,
  maxTeamSize,
  teamDeadline,
  locked,
  team,
  origin,
  invite,
  inviteError,
}: TeamCardProps) {
  const [open, setOpen] = useState<OpenDialog>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useInviteFromUrl(invite, inviteError, () => setOpen("join"));

  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };
  const count = team?.members.length ?? 0;
  const inviteUrl = team ? `${origin}${inviteLinkPath(team.inviteCode)}` : "";
  const full = maxTeamSize !== null && count >= maxTeamSize;

  return (
    <section
      aria-labelledby="your-team-heading"
      className="flex flex-col rounded-xl border border-border bg-card text-card-foreground"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 pt-5 pb-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="your-team-heading" className="text-subheading text-foreground">
            Your team
          </h2>
          <p className="text-small text-muted-foreground">{memberCountLabel(count, maxTeamSize)}</p>
        </div>
        {team && !locked ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={menuTriggerRef} variant="secondary" size="sm">
                Manage team
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {team.isOwner ? (
                <>
                  <DropdownMenuItem onSelect={() => setOpen("rename")}>Rename team</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
                    Delete team
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem variant="destructive" onSelect={() => setOpen("leave")}>
                  Leave team
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-5 p-5">
        {team ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-body-medium text-foreground">{team.displayName}</p>
              {!locked && spotsLeftLabel(count, maxTeamSize) ? (
                <p className="text-small text-muted-foreground">{spotsLeftLabel(count, maxTeamSize)}</p>
              ) : null}
            </div>
            <ul aria-label={`${team.displayName} members`}>
              {team.members.map((member) => (
                <TeamMemberRow
                  key={member.key}
                  name={member.name}
                  label={[member.isYou && "You", member.isOwner && "Owner"].filter(Boolean).join(" · ") || null}
                />
              ))}
            </ul>
            <div className="mt-auto">
              {locked ? (
                teamDeadline ? (
                  <p className="text-small text-muted-foreground">
                    Teams locked on {formatTeamDeadline(teamDeadline)}.
                  </p>
                ) : null
              ) : full ? null : (
                <InviteLinkField url={inviteUrl} />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-body-medium text-foreground">
                {locked ? "Teams are locked" : "You're not on a team yet"}
              </p>
              <p className="text-small text-muted-foreground">
                {locked
                  ? "The UX Hub team will put you on a team with other members who don't have one."
                  : teamDeadline
                    ? `Create a team, or join one with a teammate's invite link. Teams lock on ${formatTeamDeadline(teamDeadline)}.`
                    : "Create a team, or join one with a teammate's invite link."}
              </p>
            </div>
            <div className="flex flex-1 items-center justify-center py-4">
              <Hubbo emotion="resting" size="card" />
            </div>
            {locked ? null : (
              <div className="flex flex-col gap-3">
                <Button type="button" className="w-full" onClick={() => setOpen("create")}>
                  Create team
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen("join")}>
                  Join a team
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Radix unmounts each dialog's content while it's closed, so a form
          starts over on every open. */}
      <TeamNameDialog
        open={open === "create"}
        onOpenChange={close}
        target={{ kind: "create", eventId }}
        onCreated={() => setOpen("ready")}
      />
      <JoinTeamDialog open={open === "join"} onOpenChange={close} eventId={eventId} invite={invite} />
      {team ? (
        <>
          <TeamReadyDialog
            open={open === "ready"}
            onOpenChange={close}
            team={team}
            maxTeamSize={maxTeamSize}
            inviteUrl={inviteUrl}
          />
          <TeamNameDialog open={open === "rename"} onOpenChange={close} target={{ kind: "rename", team }} />
          <DeleteTeamDialog
            open={open === "delete"}
            onOpenChange={close}
            team={team}
            returnFocusRef={menuTriggerRef}
          />
          <LeaveTeamDialog
            open={open === "leave"}
            onOpenChange={close}
            team={team}
            eventId={eventId}
            returnFocusRef={menuTriggerRef}
          />
        </>
      ) : null}
    </section>
  );
}
