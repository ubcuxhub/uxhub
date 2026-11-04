import { ExternalLink } from "lucide-react";

import { ListCard, ListRow } from "@/components/shared/ListRow";
import { Avatar } from "@/components/ui/avatar";

import { Composition } from "@/app/dev/_shell/Specimen";

function LinkedInIcon() {
  return (
    // This is the exact monochrome LinkedIn asset used by the Figma component.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/linkedin.svg" alt="" className="size-4" />
  );
}

function ListRowDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Composition
        title="People and organizations"
        description="The same card and row structure supports people, organization marks, missing artwork and optional external links."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <ListCard title="Judges" summary="Meet the reviewers for this year’s showcase.">
            <ListRow
              name="Alex Chen"
              description="Senior product designer · Acme"
              lead={{ kind: "person", src: "/people/david.jpg" }}
              link={{
                href: "https://linkedin.com",
                label: "LinkedIn",
                icon: <LinkedInIcon />,
              }}
            />
            <ListRow
              name="Priya Patel"
              description="Design director · Northwind"
              lead={{ kind: "person" }}
              link={{
                href: "https://linkedin.com",
                label: "LinkedIn",
                icon: <LinkedInIcon />,
              }}
            />
            <ListRow
              name="Jordan Lee"
              description="Research lead · Contoso"
              lead={{ kind: "person", src: "/people/elaine.jpg" }}
            />
          </ListCard>

          <ListCard title="Sponsors" summary="Organizations supporting the showcase.">
            <ListRow
              name="Microsoft"
              description="Presenting partner"
              lead={{
                kind: "organization",
                logoSrc: "/sponsor-logos/microsoft.png",
              }}
            />
            <ListRow
              name="Notion"
              description="Community partner"
              lead={{
                kind: "organization",
                logoSrc: "/sponsor-logos/notion.png",
              }}
            />
            <ListRow
              name="Northwind Studio"
              description="Artwork pending · initials fallback"
              lead={{ kind: "organization" }}
            />
          </ListCard>
        </div>
      </Composition>

      <Composition
        title="List row (§4.1)"
        description="64px avatar, 18px name, role · company, and a link labelled with the person."
      >
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-section p-4">
          <div className="flex items-center gap-4">
            <Avatar name="Alex Chen" src="/people/david.jpg" size={64} decorative />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-subheading">Alex Chen</span>
              <span className="text-small text-muted-foreground">
                Senior product designer · Acme
              </span>
            </div>
            <a
              href="#list-row"
              className="inline-flex items-center gap-1 text-small text-primary underline-offset-4 hover:underline"
            >
              Alex Chen on LinkedIn
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </Composition>
    </div>
  );
}

export default ListRowDemo;
