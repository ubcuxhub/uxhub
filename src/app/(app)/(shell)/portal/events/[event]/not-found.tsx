import {
  BrowseEventsButton,
  EventPageStatus,
} from "@/features/events/components/EventPageStatus";

/**
 * No event at this link for this member: a mistyped or old slug, a deleted
 * event, a draft that was never published, or any event while the
 * student-events flag is off. Neutral on purpose, because a deleted row can't
 * be told apart from a slug that never existed. An event that was published
 * and then unpublished gets `EventRemovedStatus` from the page instead. A
 * failed query throws and reaches error.tsx.
 */
export default function EventNotFound() {
  return (
    <EventPageStatus
      title="We can't find this event"
      description="The link may be wrong, or the event isn't open to members yet. Check the link, or browse upcoming events."
      action={<BrowseEventsButton />}
    />
  );
}
