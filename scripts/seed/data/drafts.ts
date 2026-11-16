/**
 * Drafts saved through the event builder and not finished: the unified event
 * lifecycle's `working_document` state (20261115024039). The rows in
 * `events.ts` are finished events written column by column; these are the
 * builder's own JSON document, written through `save_event_working_document`
 * like a builder save, which projects whatever is representable into the
 * event's columns and leaves the rest blank.
 *
 * Neither can be published as it stands: the publication guard refuses a row
 * that still holds a working document, and each is missing something a
 * finished event needs. Local only (see `TargetPolicy.workingDrafts`).
 */

import { addDays, dateString, eventYear, startOfUtcDay } from "../lib/relative-dates.ts";

export interface SeedWorkingDraft {
  /** The draft's URL, saved as an edited page URL so it never renumbers. */
  slug: string;
  /** Cover, a file in `data/images`, written into the document as a URL. */
  imageKey?: string;
  /** Header banner, a `data/images/banner-*.png`, likewise. */
  bannerKey?: string;
  /** Fields the builder would have filled in; the rest stay at its defaults. */
  formState: Record<string, unknown>;
  /** The date rows of the builder's date and location section. */
  dates: { date: string; start: string; end: string; label: string }[];
  location: { building: string; room: string };
}

export function buildSeedWorkingDrafts(now: Date): SeedWorkingDraft[] {
  const today = startOfUtcDay(now);
  const mixer = addDays(today, 49);
  const mixerDate = dateString(mixer);

  return [
    {
      // Barely started: a name and a short overview. No dates, so the portal
      // timeline leaves it out; no cover, so cards fall back; paid with no
      // amount yet, so `regular_price` stays null.
      slug: "design-ethics-roundtable",
      formState: {
        name: "Design Ethics Roundtable",
        short_description: "Talk through the ethics of persuasive design.",
        pricing_mode: "paid",
        pricing_amount: "",
      },
      dates: [{ date: "", start: "", end: "", label: "" }],
      location: { building: "", room: "" },
    },
    {
      // Nearly finished: dated, priced and illustrated, but the long overview
      // a hosted page needs is still empty. Staff see it on /portal/events,
      // presented from the document.
      slug: "alumni-mixer",
      imageKey: "5.png",
      bannerKey: "banner-2.png",
      formState: {
        name: `Alumni Mixer ${eventYear(mixer)}`,
        short_description: "Meet UX Hub alumni working in design.",
        pricing_mode: "free",
        pricing_amount: "0",
        max_capacity: "60",
        starts_at: `${mixerDate}T18:00`,
        ends_at: `${mixerDate}T21:00`,
        registration_opens_at: `${dateString(addDays(mixer, -21))}T09:00`,
        registration_closes_at: `${mixerDate}T12:00`,
      },
      dates: [{ date: mixerDate, start: "18:00", end: "21:00", label: "Door Check-in" }],
      location: { building: "AMS Nest", room: "Room 2306" },
    },
  ];
}
