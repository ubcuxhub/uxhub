import { TabNav, TabNavLink } from "@/components/ui/tab-nav";

import { Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const EVENT = "/admin/events/uxathon-2026";

/**
 * `usePathname()` is `/dev/components` here, so every specimen pins the page it
 * pretends to be on through `pathname`. Link clicks navigate away from the
 * gallery, which is expected.
 */
function EventPages({
  pathname,
  label = "Event pages",
}: {
  pathname: string;
  label?: string;
}) {
  return (
    <TabNav aria-label={label} pathname={pathname}>
      <TabNavLink href={EVENT} exact>
        Overview
      </TabNavLink>
      <TabNavLink href={`${EVENT}/review-applications`} count={12}>
        Applications
      </TabNavLink>
      <TabNavLink href={`${EVENT}/check-in`}>Check-in</TabNavLink>
    </TabNav>
  );
}

function RouteTabs() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="TabNav"
        spec="§3.4"
        description="Pages of one object, one route each. It looks like Tabs but is a nav of links: the current one carries aria-current=page, Tab moves between them, and there are no arrow keys. Exact links match only their own path; the others also match anything below them."
        min="min(22rem, 100%)"
      >
        <Specimen label="Overview active (exact)">
          <EventPages pathname={EVENT} />
        </Specimen>
        <Specimen label="Applications active, with count (prefix)">
          <EventPages pathname={`${EVENT}/review-applications`} />
        </Specimen>
        <Specimen label="Applications active on a nested path (prefix)">
          <EventPages pathname={`${EVENT}/review-applications/42`} />
        </Specimen>
        <Specimen label="Check-in active">
          <EventPages pathname={`${EVENT}/check-in`} />
        </Specimen>
        <Specimen label="No link matches">
          <EventPages pathname="/admin/events" />
        </Specimen>
        <Specimen label="Compact density (32px)">
          <div data-density="compact" className="flex max-w-full min-w-0">
            <EventPages
              pathname={`${EVENT}/review-applications`}
              label="Event pages, compact"
            />
          </div>
        </Specimen>
        <Specimen label="Overflow: scrolls sideways in a narrow container">
          <div className="w-56 max-w-full">
            <TabNav
              aria-label="Many pages"
              pathname={`${EVENT}/history`}
            >
              <TabNavLink href={EVENT} exact>
                Overview
              </TabNavLink>
              <TabNavLink href={`${EVENT}/review-applications`} count={12}>
                Applications
              </TabNavLink>
              <TabNavLink href={`${EVENT}/check-in`}>Check-in</TabNavLink>
              <TabNavLink href={`${EVENT}/history`}>History</TabNavLink>
            </TabNav>
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

const section: GallerySection = {
  id: "route-tabs",
  title: "Route tabs",
  group: "Navigation",
  description: "TabNav: tabs that are links, for sibling pages under one object's URL.",
  importPath: "@/components/ui/tab-nav",
  importNames: ["TabNav", "TabNavLink"],
  spec: "§3.4",
  layout: "split",
  Component: RouteTabs,
};

export default section;
