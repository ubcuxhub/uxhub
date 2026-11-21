import { notFound } from "next/navigation";

import { ApplicationNotes } from "@/features/admin/components/ApplicationNotes";
import { ApplicationReviewClient } from "@/features/admin/components/ApplicationReviewClient";
import {
  defaultOfferDeadline,
  getReviewNeighbours,
  parseReviewListQuery,
  reviewScopeLabel,
  serializeReviewListQuery,
  waitlistPosition,
  withReviewState,
  type ReviewListItem,
} from "@/features/admin/lib/application-review";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { answersFromResponses } from "@/features/applications/lib/application-form";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createApplicationFileUrl } from "@/lib/supabase-helpers/application-files";
import { fetchEventApplicationSettings } from "@/lib/supabase-helpers/event-application-settings";
import {
  fetchApplicationQuestions,
  fetchApplicationResponses,
  fetchEventApplicationById,
  fetchEventApplicationSummaries,
  isSubmittedApplication,
} from "@/lib/supabase-helpers/event-applications";
import { fetchReviewerNotes } from "@/lib/supabase-helpers/application-review-notes";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; applicationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ApplicationReviewPage({
  params,
  searchParams,
}: ApplicationReviewPageProps) {
  const admin = await requireAdmin();
  const [{ event: eventParam, applicationId }, rawQuery] = await Promise.all([
    params,
    searchParams,
  ]);
  // `applicationId` is queried against a uuid column too, so a malformed one
  // is a 404 rather than a thrown Postgres error.
  if (!isUuid(applicationId)) notFound();
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(
    supabase,
    eventParam,
    `/review-applications/${applicationId}`
  );
  const application = await fetchEventApplicationById(supabase, applicationId);

  // Drafts are the applicant's alone; RLS hides them from admins as well.
  if (
    !application ||
    application.event_id !== eventId ||
    !isSubmittedApplication(application)
  ) {
    notFound();
  }

  const [event, summaries, questions, responses, notes, settings, seatCounts] = await Promise.all([
    fetchEventById(supabase, application.event_id),
    fetchEventApplicationSummaries(supabase, eventId),
    fetchApplicationQuestions(supabase, eventId),
    fetchApplicationResponses(supabase, applicationId),
    fetchReviewerNotes(supabase, applicationId),
    fetchEventApplicationSettings(supabase, eventId),
    fetchEventSeatCounts(supabase, [eventId]),
  ]);
  const seats = seatCounts.get(eventId);

  const items: ReviewListItem[] = summaries.map((summary) =>
    withReviewState(summary)
  );
  const current = summaries.find((item) => item.applicationId === applicationId);
  if (!event || !current) notFound();

  const query = parseReviewListQuery(
    new URLSearchParams(
      // A repeated param (`program`) arrives as an array.
      Object.entries(rawQuery).flatMap(([key, value]) =>
        (typeof value === "string" ? [value] : (value ?? [])).map(
          (one) => [key, one] as [string, string]
        )
      )
    )
  );
  const neighbours = getReviewNeighbours(items, query, applicationId);
  if (!neighbours) notFound();

  const base = `/admin/events/${eventId}/review-applications`;
  const target = (item: ReviewListItem | null) =>
    item
      ? {
          href: `${base}/${item.applicationId}${serializeReviewListQuery({ ...query, from: undefined })}`,
          name: item.name,
        }
      : null;
  // Back lands on the page the applicant is on; once a decision has moved
  // them out of the filter, on the page the reviewer left.
  const backHref = `${base}${serializeReviewListQuery({
    ...query,
    page: neighbours.page ?? query.page,
    from: applicationId,
  })}`;

  const fileLinks = Object.fromEntries(
    (
      await Promise.all(
        responses
          .filter(
            (response) =>
              response.event_application_questions?.response_type ===
                "file_upload" && response.response
          )
          .map(async (response) => [
            response.event_application_question_id,
            await createApplicationFileUrl(supabase, response.response),
          ])
      )
    ).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );

  return (
    <ApplicationReviewClient
      key={applicationId}
      eventName={event.name}
      application={application}
      hasTicket={current.hasTicket}
      applicant={{
        name: current.name,
        email: current.email,
        program: current.program,
        year: current.year,
        studentStatus: current.studentStatus,
        membership: current.membership,
      }}
      questions={questions}
      answers={answersFromResponses(questions, responses)}
      fileLinks={fileLinks}
      backHref={backHref}
      pager={{
        position: neighbours.position,
        total: neighbours.total,
        scope: reviewScopeLabel(query),
        previous: target(neighbours.previous),
        next: target(neighbours.next),
      }}
      defaultDeadline={defaultOfferDeadline(settings)}
      decisionsReleaseAt={settings?.decisions_release_at ?? null}
      capacity={event.max_capacity ?? null}
      seats={seats ? { tickets: seats.tickets, heldOffers: seats.heldOffers } : null}
      waitlistPosition={waitlistPosition(items, applicationId)}
      notes={
        <ApplicationNotes
          applicationId={applicationId}
          initialNotes={notes}
          currentUserId={admin.id}
        />
      }
    />
  );
}
