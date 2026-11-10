import { notFound } from "next/navigation";

import { ApplicationReviewClient } from "@/features/admin/components/ApplicationReviewClient";
import {
  getReviewNeighbours,
  parseReviewListQuery,
  reviewScopeLabel,
  serializeReviewListQuery,
  withReviewState,
  type ReviewListItem,
} from "@/features/admin/lib/application-review";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { answersFromResponses } from "@/features/applications/lib/application-form";
import { requireAdmin } from "@/lib/auth/guards";
import { pacificDate } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { createApplicationFileUrl } from "@/lib/supabase-helpers/application-files";
import {
  fetchApplicationQuestions,
  fetchApplicationResponses,
  fetchEventApplicationById,
  fetchEventApplicationSummaries,
  isSubmittedApplication,
} from "@/lib/supabase-helpers/event-applications";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; applicationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** A week out at 11:45 PM Pacific: the deadline offered until one is chosen. */
function defaultOfferDeadline() {
  const week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    date: pacificDate(week) as `${number}-${number}-${number}`,
    time: "23:45" as const,
  };
}

export default async function ApplicationReviewPage({
  params,
  searchParams,
}: ApplicationReviewPageProps) {
  await requireAdmin();
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

  const [event, summaries, questions, responses] = await Promise.all([
    fetchEventById(supabase, application.event_id),
    fetchEventApplicationSummaries(supabase, eventId),
    fetchApplicationQuestions(supabase, eventId),
    fetchApplicationResponses(supabase, applicationId),
  ]);

  const items: ReviewListItem[] = summaries.map((summary) =>
    withReviewState(summary)
  );
  const current = summaries.find((item) => item.applicationId === applicationId);
  if (!event || !current) notFound();

  const query = parseReviewListQuery(
    new URLSearchParams(
      Object.entries(rawQuery).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value] as [string, string]] : []
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
      defaultDeadline={defaultOfferDeadline()}
    />
  );
}
