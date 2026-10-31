"use client";

import { SectionNavigator, type NavigatorSection } from "@/components/shared/SectionNavigator";
import { useCurrentSection } from "@/hooks/use-current-section";
import type { GallerySection, SectionProps } from "../_gallery/types";

const sections: readonly NavigatorSection[] = [
  { id: "navigator-basics", title: "Basics", state: "complete", required: true },
  { id: "navigator-description", title: "Description", state: "complete", required: true },
  { id: "navigator-date-location", title: "Date and location", state: "complete", required: true },
  { id: "navigator-registration", title: "Registration", state: "attention", issues: 1, required: true },
  { id: "navigator-teams", title: "Teams", state: "complete", required: true },
  { id: "navigator-schedule", title: "Schedule", state: "optional", required: false },
  { id: "navigator-people", title: "People and sponsors", state: "complete", required: false },
  { id: "navigator-links", title: "Links and resources", state: "optional", required: false },
  { id: "navigator-publishing", title: "Publishing", state: "not-started", required: true },
];

function NavigatorGallery({ open }: SectionProps) {
  const observedId = useCurrentSection(sections.map((section) => section.id));
  return <div className="relative pb-28">
    <div className="mb-6 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-title font-semibold text-foreground">Event setup</h3>
      <p className="mt-2 max-w-2xl text-small text-muted-foreground">Scroll through this mock event form to follow the current section. The floating pill shows required-section progress; open it to jump to any section. Use Tab to inspect its focus ring, Enter or Space to open, arrow keys to move, and Escape to return focus.</p>
    </div>
    <div className="space-y-5">{sections.map((section, index) => <section key={section.id} id={section.id} className="min-h-64 scroll-mt-6 rounded-2xl border border-border bg-card p-6 sm:min-h-80">
      <span className="text-label tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}</span>
      <h3 className="mt-2 text-title font-semibold text-foreground">{section.title}</h3>
      <p className="mt-2 text-small text-muted-foreground">{section.state === "attention" ? "One detail needs attention before publishing." : section.state === "complete" ? "This section is complete." : section.state === "optional" ? "This section is optional." : "This section has not been started."}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-12 rounded-xl border border-border-subtle bg-muted" />
        <div className="h-12 rounded-xl border border-border-subtle bg-muted" />
      </div>
    </section>)}</div>
    <SectionNavigator title="Event setup" sections={sections} currentId={observedId} defaultOpen={open === "menu"} />
  </div>;
}

const section: GallerySection = {
  id: "section-navigator",
  title: "Section navigator",
  spec: "§3.14",
  layout: "page",
  openStates: ["menu"],
  Component: NavigatorGallery,
};

export default section;
