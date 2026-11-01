"use client";

import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ListCardProps extends React.ComponentProps<"section"> {
  title: string;
  summary: string;
}

type ListRowLead =
  | { kind: "person"; src?: string | null }
  | { kind: "organization"; logoSrc?: string | null };

interface ListRowProps {
  name: string;
  description?: string | null;
  lead: ListRowLead;
  link?: {
    href: string;
    label: string;
    icon?: React.ReactNode;
  };
}

function getOrganizationInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last =
    words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

/**
 * An organization's logo, or its initials when there is no URL or the URL
 * fails to load. Keyed on the URL so a new logo gets a fresh try.
 */
function OrganizationMark({
  name,
  logoSrc,
}: {
  name: string;
  logoSrc?: string | null;
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  if (logoSrc && failedSrc !== logoSrc) {
    return (
      // Organization marks keep their own colours; this white tile is intentional in every theme.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoSrc}
        alt=""
        className="size-12 object-contain"
        onError={() => setFailedSrc(logoSrc)}
      />
    );
  }
  return <>{getOrganizationInitials(name)}</>;
}

/** A titled card containing one vertical list of people or organizations. */
function ListCard({
  title,
  summary,
  className,
  children,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ListCardProps) {
  const titleId = React.useId();

  return (
    <section
      data-slot="list-card"
      aria-labelledby={ariaLabelledBy ?? titleId}
      className={cn(
        "flex flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground",
        className,
      )}
      {...props}
    >
      <header className="flex flex-col gap-1.5 px-4 sm:px-6">
        <h3 id={titleId} className="text-subheading">
          {title}
        </h3>
        <p className="text-small text-muted-foreground">{summary}</p>
      </header>
      <div aria-hidden className="h-px bg-border-subtle" />
      <ul className="flex flex-col gap-5 px-4 sm:px-6">{children}</ul>
    </section>
  );
}

/** A compact person or organization row for use inside ListCard. */
function ListRow({ name, description, lead, link }: ListRowProps) {
  return (
    <li
      data-slot="list-row"
      className={cn(
        // Lead | text on phones, with the link on its own line under the text;
        // lead | text | link from `sm`. Grid tracks (not flex-wrap) so the row
        // can never be wider than its card: the text track is minmax(0, 1fr).
        "grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-lg border border-border-subtle bg-section p-4",
        link && "sm:grid-cols-[4rem_minmax(0,1fr)_auto]",
      )}
    >
      {lead.kind === "person" ? (
        <Avatar name={name} src={lead.src} size={64} decorative />
      ) : (
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-white p-2 text-subheading text-black"
        >
          <OrganizationMark name={name} logoSrc={lead.logoSrc} />
        </span>
      )}

      <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
        <span className="text-subheading">{name}</span>
        {description ? (
          <span className="text-small text-muted-foreground">{description}</span>
        ) : null}
      </span>

      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} on ${link.label}`}
          className="inline-flex items-center gap-2 rounded-sm text-small text-foreground underline underline-offset-4 hover:text-primary focus-visible:focus-ring col-start-2 min-w-0 justify-self-start sm:col-start-3 sm:justify-self-end"
        >
          {link.icon}
          <span className="min-w-0 [overflow-wrap:anywhere]">{link.label}</span>
        </a>
      ) : null}
    </li>
  );
}

export { ListCard, ListRow };
export type { ListCardProps, ListRowLead, ListRowProps };
