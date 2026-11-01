import { ListCard, ListRow } from "@/components/shared/ListRow";
import { SponsorLogoGrid } from "@/components/shared/SponsorLogoGrid";

import { Composition } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const SPONSORS = [
  {
    name: "Google Cloud",
    href: "https://cloud.google.com",
    logoSrc: "/sponsor-logos/googlecloud.png",
  },
  {
    name: "Microsoft",
    href: "https://microsoft.com",
    logoSrc: "/sponsor-logos/microsoft.png",
  },
  {
    name: "Notion",
    href: "https://notion.so",
    logoSrc: "/sponsor-logos/notion.png",
  },
  {
    name: "Red Bull",
    href: "https://redbull.com",
    logoSrc: "/sponsor-logos/redbull.png",
  },
  {
    name: "TD",
    href: "https://td.com",
    logoSrc: "/sponsor-logos/td.png",
  },
  {
    name: "WillowTree",
    href: "https://willowtreeapps.com",
    logoSrc: "/sponsor-logos/willowtree.png",
  },
] as const;

function LinkedInIcon() {
  return (
    // This is the exact monochrome LinkedIn asset used by the Figma component.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/linkedin.svg" alt="" className="size-4" />
  );
}

function Section() {
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
        title="Sponsor logo grid"
        description="Five columns on desktop, three from 600px and two on mobile. Brand artwork stays on a white tile in both themes."
      >
        <SponsorLogoGrid sponsors={SPONSORS} />
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "lists",
  title: "Lists and sponsor logos",
  group: "Data display",
  description: "ListRow for people and organizations, and the sponsor logo grid.",
  spec: "§4.1, §4.2",
  layout: "page",
  Component: Section,
};

export default section;
