import { ExternalLink, Globe, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeContentUrl } from "@/features/admin/lib/event-content";
import type { MentorRow, SponsorRow } from "@/lib/supabase/models";

/**
 * One card is one people section (titled by the event's builder: Judges,
 * Mentors, Speakers, Panelists or a custom name) or the sponsors list.
 */
type EventPeopleCardProps =
  | { type: "people"; title: string; people: MentorRow[] }
  | { type: "sponsors"; people: SponsorRow[] };

/** What a row renders, whichever table it came from. */
interface PersonItem {
  id: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  link: { href: string; label: string; ariaLabel: string; icon: LucideIcon } | null;
}

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
          icon: ExternalLink,
        }
      : null,
  };
}

function sponsorItem(sponsor: SponsorRow): PersonItem {
  const website = sponsor.website_url && safeContentUrl(sponsor.website_url) ? sponsor.website_url : null;
  return {
    id: sponsor.id,
    name: sponsor.name,
    subtitle: sponsor.description?.trim() || null,
    imageUrl: sponsor.brand_logo_path,
    link: website
      ? { href: website, label: "Website", ariaLabel: `${sponsor.name} website`, icon: Globe }
      : null,
  };
}

/** A card listing one people section or the sponsors. Renders nothing for an empty list. */
export function EventPeopleCard(props: EventPeopleCardProps) {
  if (props.people.length === 0) return null;

  const { title, noun, items } =
    props.type === "people"
      ? { title: props.title, noun: sectionNoun(props.title), items: props.people.map(mentorItem) }
      : { title: "Sponsors", noun: SPONSOR_NOUN, items: props.people.map(sponsorItem) };

  // The same card as Registration and Agenda (Figma 1.3, "Judges").
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-0.5 border-b px-5 pt-5 [.border-b]:pb-4">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>
          {items.length} {items.length === 1 ? noun.singular : noun.plural}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <ul className="flex flex-col gap-3">
          {items.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-section px-4 py-3"
            >
              <PersonAvatar name={person.name} imageUrl={person.imageUrl} />

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-body-medium wrap-anywhere">{person.name}</p>
                {person.subtitle && <p className="text-small text-muted-foreground wrap-anywhere">{person.subtitle}</p>}
              </div>

              {person.link && (
                <a
                  href={person.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${person.link.ariaLabel} (opens in a new tab)`}
                  className="flex shrink-0 items-center gap-2 rounded-sm text-small text-foreground underline-offset-2 hover:underline"
                >
                  <person.link.icon className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {person.link.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "Sarah Jenkins" → "SJ"; one word gives one letter. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => Array.from(word)[0]?.toUpperCase() ?? "").join("");
}

function PersonAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <div
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-small font-semibold text-muted-foreground"
      >
        {initials(name)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
  );
}
