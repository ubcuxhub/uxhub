import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocsLink } from "@/app/dev/_shell/context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ENTRY_GROUPS, entryPath, type EntryGroup } from "./_registry";
import { APP_COMPONENTS } from "./_registry/types";
import { legacyRedirect } from "./_registry/resolve";

export const metadata: Metadata = { title: "Components · UX Hub components" };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The components index: every category with its entries, then the app
 * components. `?section=<id>`, the single-page gallery's old address, is
 * redirected to the page that id now lives at.
 */
export default async function ComponentsIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const target = legacyRedirect(await searchParams);
  if (target === null) notFound();
  if (target) redirect(target);

  const categories = ENTRY_GROUPS.filter((group) => !group.app);
  const app = ENTRY_GROUPS.find((group) => group.app);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Components</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Every shared component in its variants and states, on fixture data:
          nothing is fetched and nothing needs a sign-in.
        </p>
      </header>

      {categories.map((group) => (
        <section
          key={group.id}
          id={group.id}
          data-toc={group.title}
          aria-labelledby={`${group.id}-heading`}
          className="flex scroll-mt-20 flex-col gap-4 border-t border-border-subtle pt-8"
        >
          <GroupHeading group={group} />
          <EntryLinks group={group} />
        </section>
      ))}

      {app ? (
        <section
          id={app.id}
          data-toc={app.title}
          aria-labelledby={`${app.id}-heading`}
          className="flex scroll-mt-20 flex-col gap-4 rounded-2xl border border-border-subtle bg-section p-6"
        >
          <GroupHeading group={app} badge={APP_COMPONENTS.badge} />
          <EntryLinks group={app} />
        </section>
      ) : null}
    </div>
  );
}

function GroupHeading({ group, badge }: { group: EntryGroup; badge?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${group.id}-heading`} className="text-subheading">
          {group.title}
        </h2>
        {badge ? <Badge variant="neutral">{badge}</Badge> : null}
      </div>
      <p className="max-w-prose text-small text-muted-foreground">{group.blurb}</p>
    </div>
  );
}

function EntryLinks({ group }: { group: EntryGroup }) {
  return (
    <ul
      className={cn(
        "grid gap-x-6 gap-y-3",
        "[grid-template-columns:repeat(auto-fill,minmax(min(13.75rem,100%),1fr))]",
      )}
    >
      {group.entries.map((entry) => (
        <li key={entry.slug}>
          <DocsLink
            href={entryPath(entry.slug)}
            className="rounded-sm text-body-medium text-primary underline-offset-4 hover:underline focus-visible:focus-ring"
          >
            {entry.title}
          </DocsLink>
        </li>
      ))}
    </ul>
  );
}
