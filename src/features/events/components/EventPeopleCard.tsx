import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import type { MentorRow, SponsorRow } from "@/lib/supabase/models";

/** One card shows one kind of person; `type` decides which row type `people` holds. */
type EventPeopleCardProps =
  | { type: "mentors"; people: MentorRow[] }
  | { type: "sponsors"; people: SponsorRow[] };

/** What a row renders, whichever table it came from. */
interface PersonItem {
  id: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  link: { href: string; label: string; ariaLabel: string; icon: ReactNode } | null;
}

interface PeopleKind<Row> {
  title: string;
  singular: string;
  plural: string;
  toItem: (row: Row) => PersonItem;
}

const linkedInIcon = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/icons/linkedin.svg" width={16} height={16} alt="" />
);

/**
 * Per-type setup. Adding judges or speakers later means adding an entry here
 * and a member to `EventPeopleCardProps`; the card itself stays the same.
 */
const PEOPLE_KINDS: { mentors: PeopleKind<MentorRow>; sponsors: PeopleKind<SponsorRow> } = {
  mentors: {
    title: "Mentors",
    singular: "mentor",
    plural: "mentors",
    toItem: (mentor) => ({
      id: mentor.id,
      name: mentor.full_name,
      subtitle: mentor.position,
      imageUrl: mentor.profile_image_path,
      link: mentor.linkedin_url
        ? {
            href: mentor.linkedin_url,
            label: "LinkedIn",
            ariaLabel: `${mentor.full_name} on LinkedIn`,
            icon: linkedInIcon,
          }
        : null,
    }),
  },
  sponsors: {
    title: "Sponsors",
    singular: "sponsor",
    plural: "sponsors",
    // `sponsors` has no tagline or website column yet. Once it does, map the
    // tagline to `subtitle` and the website to:
    //   { href: sponsor.website_url, label: "Website", ariaLabel: `${sponsor.name} website`,
    //     icon: <Link2 className="size-4 shrink-0 text-fg-secondary" aria-hidden /> }
    // with `Link2` from lucide-react.
    toItem: (sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      subtitle: null,
      imageUrl: sponsor.brand_logo_path,
      link: null,
    }),
  },
};

/** A card listing an event's mentors or sponsors. Renders nothing for an empty list. */
export function EventPeopleCard(props: EventPeopleCardProps) {
  if (props.people.length === 0) return null;

  const { title, singular, plural, items } =
    props.type === "mentors"
      ? { ...PEOPLE_KINDS.mentors, items: props.people.map(PEOPLE_KINDS.mentors.toItem) }
      : { ...PEOPLE_KINDS.sponsors, items: props.people.map(PEOPLE_KINDS.sponsors.toItem) };

  return (
    <section className="flex flex-col gap-5 rounded-md border border-border-subtle p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-h3">{title}</h3>
          <p className="text-fg-secondary">
            Displaying {items.length} {items.length === 1 ? singular : plural}
          </p>
        </div>
        <Separator />
      </div>

      <ul className="flex flex-col gap-5">
        {items.map((person) => (
          <li
            key={person.id}
            className="flex items-center gap-4 rounded-sm border bg-(--background-secondary) p-4"
          >
            <PersonAvatar name={person.name} imageUrl={person.imageUrl} />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-subheading">{person.name}</p>
              {person.subtitle && <p className="text-fg-secondary">{person.subtitle}</p>}
            </div>

            {person.link && (
              <a
                href={person.link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={person.link.ariaLabel}
                className="flex shrink-0 items-center gap-2 text-button underline underline-offset-2 hover:text-action-hover"
              >
                {person.link.icon}
                {person.link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <div
        aria-hidden
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-subheading text-fg-secondary"
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
  );
}
