import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import type { MentorRow, SponsorRow } from "@/lib/supabase/models";

/**
 * One card is one people section (titled by the event's builder: Judges,
 * Mentors, Speakers, Panelists or a custom name) or the sponsors list.
 */
type EventPeopleCardProps = (
  | { type: "people"; title: string; people: MentorRow[] }
  | { type: "sponsors"; people: SponsorRow[] }
) & {
  /** The title's level: "h2" where the cards sit right under the page's own heading. */
  headingAs?: "h2" | "h3";
};

/** What a row renders, whichever table it came from. */
interface PersonItem {
  id: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  link: { href: string; label: string; ariaLabel: string; icon: ReactNode } | null;
}

const linkedInIcon = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/icons/linkedin.svg" width={16} height={16} alt="" />
);

/**
 * The count line's noun for the standard section titles. A custom title
 * ("Organizers", "Hosts") counts people, since its singular can't be guessed.
 */
const SECTION_NOUNS: Record<string, { singular: string; plural: string }> = {
  mentors: { singular: "mentor", plural: "mentors" },
  judges: { singular: "judge", plural: "judges" },
  speakers: { singular: "speaker", plural: "speakers" },
  panelists: { singular: "panelist", plural: "panelists" },
};
const PEOPLE_NOUN = { singular: "person", plural: "people" };
const SPONSOR_NOUN = { singular: "sponsor", plural: "sponsors" };

/** Matches the database's one-title-per-event rule: case and spacing don't count. */
export function sectionNoun(title: string) {
  return SECTION_NOUNS[title.trim().toLowerCase()] ?? PEOPLE_NOUN;
}

function mentorItem(mentor: MentorRow): PersonItem {
  return {
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
  };
}

// `sponsors` has description and website_url columns now. To show them, map
// the description to `subtitle` and the website to:
//   { href: sponsor.website_url, label: "Website", ariaLabel: `${sponsor.name} website`,
//     icon: <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden /> }
// with `Link2` from lucide-react.
function sponsorItem(sponsor: SponsorRow): PersonItem {
  return {
    id: sponsor.id,
    name: sponsor.name,
    subtitle: null,
    imageUrl: sponsor.brand_logo_path,
    link: null,
  };
}

/** A card listing one people section or the sponsors. Renders nothing for an empty list. */
export function EventPeopleCard(props: EventPeopleCardProps) {
  if (props.people.length === 0) return null;

  const Heading = props.headingAs ?? "h3";
  const { title, noun, items } =
    props.type === "people"
      ? { title: props.title, noun: sectionNoun(props.title), items: props.people.map(mentorItem) }
      : { title: "Sponsors", noun: SPONSOR_NOUN, items: props.people.map(sponsorItem) };

  return (
    <section className="flex flex-col gap-5 rounded-md border border-border-subtle p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Heading className="text-h3">{title}</Heading>
          <p className="text-muted-foreground">
            Displaying {items.length} {items.length === 1 ? noun.singular : noun.plural}
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
              {person.subtitle && <p className="text-muted-foreground">{person.subtitle}</p>}
            </div>

            {person.link && (
              <a
                href={person.link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={person.link.ariaLabel}
                className="flex shrink-0 items-center gap-2 text-button underline underline-offset-2 hover:text-primary-hover"
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
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-subheading text-muted-foreground"
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
