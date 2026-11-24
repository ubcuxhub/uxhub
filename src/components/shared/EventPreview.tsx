import Link from "next/link";
import { ExternalLink, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EventBanner } from "./EventBanner";

export interface PreviewFact { label: string; icon: LucideIcon; value: ReactNode }

/** Wide event preview: artwork, bordered details and a responsive action grid. */
export function EventPreview({ title, href, description, banner, status, facts, actions }: {
  title: string; href: string; description?: string | null;
  banner: { src?: string | null; colour?: string | null };
  status: ReactNode; facts: PreviewFact[]; actions: ReactNode;
}) {
  return <article data-slot="event-preview" className="min-w-0 space-y-6">
    <div className="space-y-4">
      <EventBanner {...banner} />
      <Card className="min-w-0 gap-3 px-8 py-6 shadow-none">
        <div>{status}</div>
        <h3 className="text-h3 wrap-anywhere"><Link href={href} className="rounded-sm transition-colors duration-fast hover:text-primary focus-visible:focus-ring">
          {title}<ExternalLink aria-hidden="true" className="ml-2 inline size-4" />
        </Link></h3>
        {description && <p className="text-small whitespace-pre-wrap wrap-anywhere">{description}</p>}
        <dl className="flex flex-col gap-4 text-small">
          {facts.map(({ label, icon: Icon, value }) => <div key={label} className="flex items-start gap-2">
            <dt className="shrink-0 pt-0.5"><Icon aria-hidden="true" className="size-4" /><span className="sr-only">{label}</span></dt>
            <dd className="min-w-0 wrap-anywhere">{value}</dd>
          </div>)}
        </dl>
      </Card>
    </div>
    <section aria-label="Quick Actions" className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 [&>a]:h-auto [&>a]:min-h-11 [&>a]:whitespace-normal [&>a]:py-2 sm:[&>a]:min-h-10">{actions}</section>
  </article>;
}

export function EventPreviewSkeleton() {
  return <div role="status" aria-label="Loading upcoming event" className="space-y-6">
    <Skeleton className="h-50 w-full rounded-lg" />
    <Card aria-hidden="true" className="gap-4 px-8 py-6 shadow-none">
      <Skeleton className="h-7 w-36 rounded-full" /><Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-3/4" />)}
    </Card>
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 rounded-full" />)}</div>
  </div>;
}
