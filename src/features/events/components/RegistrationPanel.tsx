import Link from "next/link";

import { FlowLink } from "@/components/shared/FlowLink";
import { Ticket } from "@/components/shared/Ticket";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventState } from "@/features/events/lib/event-states";
import {
  getPanelSpec,
  type ActionLayoutProps,
  type AlertLayoutProps,
  type PanelAction,
  type PanelContext,
  type TicketLayoutProps,
} from "@/features/events/lib/registration-panel";
import { hasApplicationAnswer } from "@/lib/application-response";
import { createCheckInToken } from "@/lib/check-in-token";
import { formatEventDateLabel, pacificDate } from "@/lib/date";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";
import {
  fetchApplicationQuestions,
  fetchApplicationResponses,
  fetchUserEventApplication,
} from "@/lib/supabase-helpers/event-applications";
import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import type { DbClient } from "@/lib/supabase-helpers/types";
import { cn } from "@/lib/utils";

import { QrCode } from "./QrCode";
import { TicketDialog } from "./TicketDialog";

type PanelEvent = Pick<
  EventRow,
  | "id"
  | "name"
  | "slug"
  | "starts_at"
  | "ends_at"
  | "event_colour"
  | "image_url"
  | "member_price"
  | "regular_price"
>;

interface RegistrationPanelProps {
  event: PanelEvent & { slug: string };
  user: UserInfoRow;
  state: EventState;
}

/** What the ticket layout draws, beyond its copy. */
interface TicketView {
  eventName: string;
  holderName: string;
  eventColour: string | null;
  imageUrl: string | null;
  /** `null` when the code couldn't be signed; the ticket then shows none. */
  qrToken: string | null;
  dateLabel: string | null;
}

/**
 * The Registration card on the portal event page: one of three layouts (an
 * alert, an action, or the ticket) chosen and worded by `getPanelSpec` from
 * the student's event state. A server component, so it signs the ticket's
 * check-in code itself and fetches only what the state needs: the
 * participant package for a ticket holder, and a draft's progress.
 */
export async function RegistrationPanel({ event, user, state }: RegistrationPanelProps) {
  const supabase = await createClient();
  const holdsTicket = state.kind === "reg-going" || state.kind === "reg-checked-in";

  const [links, draftProgress] = await Promise.all([
    holdsTicket ? fetchEventLinks(supabase, event.id) : [],
    state.kind === "app-draft" ? loadDraftProgress(supabase, event.id, user.id) : null,
  ]);

  const isMember = Boolean(user.membership_type_id);
  const context: PanelContext = {
    eventName: event.name,
    eventSlug: event.slug,
    endsAt: event.ends_at ?? event.starts_at,
    // The checkout's own rule (EventCheckout), so the two never disagree.
    price: { amount: isMember ? event.member_price : event.regular_price, isMember },
    participantPackageUrl: links.find((link) => link.type === "participant_package")?.url ?? null,
    draftProgress,
  };
  const spec = getPanelSpec(state, context);

  return (
    <Card className="@container gap-0 py-0">
      <CardHeader className="gap-0.5 border-b px-5 pt-5 [.border-b]:pb-4">
        <CardTitle>{spec.title}</CardTitle>
        {spec.subheading ? <CardDescription>{spec.subheading}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-5">
        {spec.layout === "alert" ? (
          <AlertLayout {...spec.props} />
        ) : spec.layout === "action" ? (
          <ActionLayout {...spec.props} />
        ) : (
          <TicketLayout
            {...spec.props}
            ticket={{
              eventName: event.name,
              holderName: holderName(user),
              eventColour: event.event_colour,
              imageUrl: event.image_url,
              qrToken: "ticketId" in state ? signTicket(state.ticketId) : null,
              dateLabel: ticketDateLabel(event.starts_at, event.ends_at),
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AlertLayout({ variant, icon: Icon, title, description, link }: AlertLayoutProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant={variant} icon={Icon ? <Icon /> : undefined} className="w-full gap-4 rounded-lg">
        <AlertTitle className="text-body">{title}</AlertTitle>
        <AlertDescription className="text-small">{description}</AlertDescription>
      </Alert>
      {link ? <PanelButton action={link} variant="link" size="sm" /> : null}
    </div>
  );
}

function ActionLayout({ title, description, action }: ActionLayoutProps) {
  return (
    <div className="flex flex-col gap-4 @xl:flex-row @xl:items-center @xl:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-body font-medium">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
      <PanelButton action={action} className="@max-xl:w-full" />
    </div>
  );
}

/**
 * Wide (from an 896px card): the copy and buttons on the left, up to 480px,
 * and the 444px ticket 40px to their right; spare width stays on the far
 * right. The buttons sit in a row that wraps when the column is narrow.
 * Narrower: the copy, then the ticket, then the buttons at full width
 * (Figma "RegistrationTicket").
 */
function TicketLayout({
  title,
  description,
  priceLine,
  ticketState,
  primary,
  secondary,
  ticket,
}: TicketLayoutProps & { ticket: TicketView }) {
  const hasActions = Boolean(primary || secondary);

  return (
    <div className="grid gap-4 @4xl:grid-cols-[minmax(0,480px)_444px] @4xl:items-center @4xl:gap-x-10">
      <div className={cn("flex min-w-0 flex-col gap-1 text-body", hasActions && "@4xl:self-end")}>
        {title ? <p className="text-foreground">{title}</p> : null}
        <p className={title ? "text-muted-foreground" : "text-foreground"}>{description}</p>
        {priceLine ? <p className="mt-2 text-small text-muted-foreground">{priceLine}</p> : null}
      </div>

      <Ticket
        className="@4xl:col-start-2 @4xl:row-span-2 @4xl:row-start-1"
        eventName={ticket.eventName}
        holderName={ticket.holderName}
        eventColour={ticket.eventColour ?? undefined}
        state={ticketState}
        code={ticket.qrToken ? <QrCode token={ticket.qrToken} className="size-full" /> : null}
      />

      {hasActions ? (
        <div className="flex flex-col gap-3 @4xl:flex-row @4xl:flex-wrap @4xl:self-start">
          {primary ? <PanelButton action={primary} ticket={ticket} /> : null}
          {secondary ? <PanelButton action={secondary} variant="secondary" ticket={ticket} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PanelButton({
  action,
  variant = "primary",
  size,
  className,
  ticket,
}: {
  action: PanelAction;
  variant?: "primary" | "secondary" | "link";
  size?: "sm";
  className?: string;
  ticket?: TicketView;
}) {
  const props = { variant, size, className } as const;

  switch (action.kind) {
    case "flow":
      return (
        <Button asChild {...props}>
          <FlowLink href={action.href}>{action.label}</FlowLink>
        </Button>
      );
    case "link":
      return (
        <Button asChild {...props}>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      );
    case "external":
      return (
        <Button asChild {...props}>
          <a href={action.href} target="_blank" rel="noopener noreferrer">
            {action.label}
          </a>
        </Button>
      );
    case "view-ticket": {
      const button = <Button {...props}>{action.label}</Button>;
      // Without a signed code there's nothing to show.
      if (!ticket?.qrToken) return <Button {...props} disabled>{action.label}</Button>;
      return (
        <TicketDialog
          trigger={button}
          eventName={ticket.eventName}
          holderName={ticket.holderName}
          eventColour={ticket.eventColour}
          imageUrl={ticket.imageUrl}
          qrToken={ticket.qrToken}
          dateLabel={ticket.dateLabel}
        />
      );
    }
  }
}

/** The check-in code for a ticket, or `null` (logged) when it can't be signed. */
function signTicket(ticketId: string): string | null {
  try {
    return createCheckInToken(ticketId);
  } catch (error) {
    log.error("event.check_in_token_failed", { ticketId, ...errorFields(error) });
    return null;
  }
}

function holderName(user: Pick<UserInfoRow, "first_name" | "last_name" | "email">): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || (user.email ?? "");
}

/** "Nov 14–28, 2026" in Pacific time; the label already names both years across one. */
function ticketDateLabel(start: string | null, end: string | null): string | null {
  const label = formatEventDateLabel(start, end);
  if (!label || !start) return label;
  return /\d{4}/.test(label) ? label : `${label}, ${pacificDate(start).slice(0, 4)}`;
}

/** How many of the event's questions a draft has answered, as submit counts them. */
async function loadDraftProgress(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<PanelContext["draftProgress"]> {
  const [questions, application] = await Promise.all([
    fetchApplicationQuestions(supabase, eventId),
    fetchUserEventApplication(supabase, eventId, userId),
  ]);
  if (!application) return null;

  const responses = await fetchApplicationResponses(supabase, application.id);
  const answers = new Map(
    responses.map((response) => [response.event_application_question_id, response.response])
  );
  const answered = questions.filter((question) =>
    hasApplicationAnswer(question.response_type, answers.get(question.id))
  ).length;
  return { answered, total: questions.length };
}
