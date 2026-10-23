import { Separator } from "@/components/ui/separator";
import type { MentorRow } from "@/lib/supabase/models";
import type { SponsorRow } from "@/lib/supabase/models";

interface EventMentorsTableProps {
  mentors?: MentorRow[];
  sponsors?: SponsorRow[];
}

/** The mentors card on the portal event page. Renders nothing for an event without mentors. */
export function EventMentorsTable({ mentors }: EventMentorsTableProps) {
  if (mentors.length === 0) return null;

  return (
    <section className="flex flex-col gap-5 rounded-md border border-border-subtle p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-h3">Mentors</h3>
          <p className="text-fg-secondary">
            Displaying {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"}
          </p>
        </div>
        <Separator />
      </div>

      <ul className="flex flex-col gap-5">
        {mentors.map((mentor) => (
          <li
            key={mentor.id}
            className="flex items-center gap-4 rounded-sm border bg-(--background-secondary) p-4"
          >
            <MentorAvatar mentor={mentor} />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-subheading">{mentor.full_name}</p>
              {mentor.position && <p className="text-fg-secondary">{mentor.position}</p>}
            </div>

            {mentor.linkedin_url && (
              <a
                href={mentor.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${mentor.full_name} on LinkedIn`}
                className="flex shrink-0 items-center gap-2 text-button underline underline-offset-2 hover:text-action-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/linkedin.svg" width={16} height={16} alt="" />
                LinkedIn
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MentorAvatar({ mentor }: { mentor: MentorRow }) {
  if (!mentor.profile_image_path) {
    return (
      <div
        aria-hidden
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-subheading text-fg-secondary"
      >
        {mentor.full_name.charAt(0)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mentor.profile_image_path}
      alt=""
      className="size-16 shrink-0 rounded-full object-cover"
    />
  );
}
