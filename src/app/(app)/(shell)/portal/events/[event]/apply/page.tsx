import { notFound, redirect } from "next/navigation";

import { ApplicationForm } from "@/features/applications/components/ApplicationForm";
import {
  answersFromResponses,
  applicationWindow,
  formatYearLevel,
} from "@/features/applications/lib/application-form";
import { requireAuth } from "@/lib/auth/guards";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { createApplicationFileUrl } from "@/lib/supabase-helpers/application-files";
import {
  fetchApplicationQuestions,
  fetchApplicationResponses,
  fetchUserEventApplication,
} from "@/lib/supabase-helpers/event-applications";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { formatUserName } from "@/lib/user-name";

interface ApplyPageProps {
  params: Promise<{ event: string }>;
}

/** "December 13, 2026 at 3:59 PM", in Pacific time. */
function formatDeadline(value: string | null): string | null {
  const date = formatEventDate(value);
  if (!date) return null;
  const time = formatEventTime(value);
  return time ? `${date} at ${time}` : date;
}

/**
 * The member's application to an event that requires one. Drafts are edited
 * here; a submitted application is shown read-only. Decided ones go back to
 * the event page, which shows the decision.
 */
export default async function ApplyPage({ params }: ApplyPageProps) {
  if (!FLAGS.studentEvents) notFound();

  const { event: slug } = await params;
  const user = await requireAuth(`/portal/events/${slug}/apply`);
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug);
  if (!event) notFound();

  const eventPath = `/portal/events/${event.slug ?? slug}`;
  if (!event.requires_application) redirect(eventPath);

  const [questions, application] = await Promise.all([
    fetchApplicationQuestions(supabase, event.id),
    fetchUserEventApplication(supabase, event.id, user.id),
  ]);
  if (application && application.status !== "draft" && application.status !== "submitted") {
    redirect(eventPath);
  }

  const responses = application
    ? await fetchApplicationResponses(supabase, application.id)
    : [];
  const answers = answersFromResponses(questions, responses);

  const fileLinks: Record<string, string> = {};
  if (application?.status === "submitted") {
    await Promise.all(
      questions
        .filter((question) => question.response_type === "file_upload")
        .map(async (question) => {
          const path = answers[question.id];
          if (typeof path !== "string" || !path) return;
          const url = await createApplicationFileUrl(supabase, path, 60 * 60);
          if (url) fileLinks[question.id] = url;
        })
    );
  }

  return (
    <ApplicationForm
      event={{ id: event.id, slug: event.slug ?? slug, name: event.name }}
      status={!application ? "new" : application.status === "submitted" ? "submitted" : "draft"}
      applicationId={application?.id ?? null}
      window={applicationWindow(event)}
      opensAt={formatDeadline(event.registration_opens_at)}
      closesAt={formatDeadline(event.registration_closes_at)}
      submittedAt={formatEventDate(application?.submitted_at ?? null)}
      profile={{
        name: formatUserName(user),
        email: user.email,
        studentNumber: user.student_number ? String(user.student_number) : "Not set",
        year: formatYearLevel(user.year),
      }}
      questions={questions}
      initialAnswers={answers}
      fileLinks={fileLinks}
    />
  );
}
