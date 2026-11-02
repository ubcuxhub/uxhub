import { SponsorLogoGrid } from "@/components/shared/SponsorLogoGrid";

import { Composition } from "@/app/dev/_shell/Specimen";

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

function SponsorLogoGridDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Composition
        title="Sponsor logo grid"
        description="Five columns on desktop, three from 600px and two on mobile. Brand artwork stays on a white tile in both themes."
      >
        <SponsorLogoGrid sponsors={SPONSORS} />
      </Composition>
    </div>
  );
}

export default SponsorLogoGridDemo;
