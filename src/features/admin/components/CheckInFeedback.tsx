import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEventTime } from "@/lib/date";
import type { useItemCheckIn } from "@/features/admin/hooks/use-item-check-in";

export function CheckInFeedback({ state, eventId }: { state: ReturnType<typeof useItemCheckIn>; eventId: string }) {
  const last = state.lastRefresh ? formatEventTime(state.lastRefresh) : "not refreshed yet";
  if (!state.snapshot.items.length)
    return <EmptyState title="No check-in items" description="Turn on Check attendees in for an agenda item in the event editor." actions={<Button asChild variant="secondary">
      <Link href={`/admin/events/${eventId}/edit#builder-agenda`}>Open event editor</Link>
    </Button>} />;
  return <>
    {state.forbidden ? <Alert variant="destructive">
      <AlertTitle>You no longer have access to check-in.</AlertTitle>
      <AlertDescription>
        <Link href="/admin/events">Back to Manage Events</Link>
      </AlertDescription>
    </Alert> : null}
    {!state.itemId || !state.snapshot.items.some(i => i.id === state.itemId) ? <Alert>
      <AlertTitle>This check-in item is unavailable.</AlertTitle>
      <AlertDescription>Choose an item to continue.</AlertDescription>
    </Alert> : null}
    {!state.online ? <Alert variant="warning">
      <AlertTitle>You&apos;re offline.</AlertTitle>
      <AlertDescription>Check-ins and undo can&apos;t be saved until you reconnect. Last refreshed: {last}.</AlertDescription>
    </Alert> : state.error ? <Alert variant="destructive">
      <AlertTitle>Couldn&apos;t refresh check-in.</AlertTitle>
      <AlertDescription>Last refreshed: {last}. <Button variant="secondary" size="sm" onClick={() => void state.refresh()}>Try again</Button>
      </AlertDescription>
    </Alert> : null}
    {state.loading ? <div aria-busy="true" aria-label="Loading check-in" className="flex flex-col gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div> : null}
  </>;
}
