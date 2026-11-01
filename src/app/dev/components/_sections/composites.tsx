"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { BackButton, BackPill } from "@/components/shared/BackButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyCode } from "@/components/shared/CopyCode";
import { MarketingEventCard } from "@/features/marketing/components/MarketingEventCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";
import { Button } from "@/components/ui/button";
import type { EventRow } from "@/lib/supabase/models";

import { Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = [
  "confirm",
  "confirm-typed",
  "confirm-pending",
  "confirm-error",
] as const;

const EVENT: EventRow = {
  agenda: null,
  created_at: "2026-09-01T00:00:00Z",
  description:
    "A 24-hour design sprint. Teams of four ship a prototype with feedback from industry mentors.",
  description_images: null,
  ends_at: "2026-11-15T18:00:00Z",
  event_type: "flagship",
  id: "00000000-0000-0000-0000-000000000001",
  image_url: "/about-us-1.png",
  location_address_url: null,
  location_building: "Henry Angus",
  location_room: "098",
  max_capacity: 120,
  member_price: 10,
  mentors_enabled: true,
  name: "UXathon 2026",
  publish_at: null,
  registration_closes_at: null,
  registration_opens_at: null,
  regular_price: 25,
  requires_application: true,
  short_description: "A 24-hour design sprint with mentors from industry.",
  slug: "uxathon-2026",
  sponsors_enabled: true,
  starts_at: "2026-11-14T18:00:00Z",
  status: "active",
  updated_at: "2026-09-01T00:00:00Z",
};

const FREE_EVENT: EventRow = {
  ...EVENT,
  id: "00000000-0000-0000-0000-000000000002",
  name: "Portfolio review night with a very long event title that clamps",
  image_url: null,
  regular_price: 0,
  member_price: 0,
  short_description: null,
  slug: "portfolio-review",
  event_type: "regular",
};

type ConfirmKey = (typeof OPEN_STATES)[number];

function ConfirmDialogs({ open }: { open?: string }) {
  const [active, setActive] = useState<ConfirmKey | null>(
    OPEN_STATES.find((state) => state === open) ?? null,
  );
  const close = (next: boolean) => {
    if (!next) setActive(null);
  };
  const common = {
    onOpenChange: close,
    icon: <TriangleAlert aria-hidden />,
    title: "Delete UXathon?",
    description:
      "This removes the event and its registrations, and can’t be undone.",
    confirmLabel: "Delete event",
    cancelLabel: "Keep event",
    onConfirm: () => {},
  };

  return (
    <>
      <Specimen label="Plain (?open=confirm)">
        <Button variant="outline" onClick={() => setActive("confirm")}>
          Open plain confirm
        </Button>
        <ConfirmDialog {...common} open={active === "confirm"} />
      </Specimen>
      <Specimen label="Typed challenge (?open=confirm-typed)">
        <Button variant="outline" onClick={() => setActive("confirm-typed")}>
          Open typed confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-typed"}
          confirmation={{
            label: "Event name",
            hint: (
              <>
                Type <b>uxathon-2026</b> to confirm.
              </>
            ),
            placeholder: "Event name",
            matches: (typed) => typed === "uxathon-2026",
            mismatchMessage: "That doesn’t match the event name.",
          }}
        />
      </Specimen>
      <Specimen label="Pending (?open=confirm-pending)">
        <Button variant="outline" onClick={() => setActive("confirm-pending")}>
          Open pending confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-pending"}
          pending
          pendingLabel="Deleting…"
        />
      </Specimen>
      <Specimen label="Server error (?open=confirm-error)">
        <Button variant="outline" onClick={() => setActive("confirm-error")}>
          Open error confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-error"}
          error="Couldn’t delete the event. Try again."
        />
      </Specimen>
    </>
  );
}

/** Drawn inside a transformed frame so its `fixed inset-0` stays contained. */
function SuccessOverlayFrame() {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-xl border [transform:translateZ(0)]">
      <SuccessOverlay message="The application was accepted." onClose={() => {}} />
    </div>
  );
}

function Composites({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="BackButton"
        spec="§4.5"
        description="40px pill, 20px side padding, 16px arrow, 8px gap. Rendered by PageContainer and by feature pages with a backHref."
        min="16rem"
      >
        <Specimen label="BackButton, named parent">
          <BackButton link="/dev/components" label="Back to Events" />
        </Specimen>
        <Specimen label="BackPill, long label">
          <BackPill href="/dev/components" label="Back to Manage Events" />
        </Specimen>
        <Specimen label="hover (forced)">
          <BackPill
            href="/dev/components"
            label="Back to Events"
            className="bg-muted"
          />
        </Specimen>
        <Specimen label="focus (forced)">
          <BackPill
            href="/dev/components"
            label="Back to Events"
            className="focus-ring"
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="PageContainer"
        spec="§2.3"
        description="Top 40px on desktop and tablet, 32px on mobile; sides 20 / 24 / 64. The back pill sits 24px above the title. Shown in a frame, so check the mobile preset too."
        min="100%"
      >
        <Specimen label="with backHref" bare>
          <div className="w-full overflow-hidden rounded-xl border border-dashed border-border bg-section">
            <PageContainer backHref="/dev/components" backLabel="Back to Events">
              <h3 className="text-h2">Page title</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Content sits inside max-w-6xl with responsive side padding.
              </p>
            </PageContainer>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="MarketingEventCard"
        description="As on the marketing /events page: image or placeholder, priced footer or link. The portal card is EventCard, in Event cards and timeline."
        min="20rem"
      >
        <Specimen label="image, priced (member price)" bare>
          <MarketingEventCard event={EVENT} className="w-full max-w-sm" />
        </Specimen>
        <Specimen label="no image, free, long title" bare>
          <MarketingEventCard event={FREE_EVENT} className="w-full max-w-sm" />
        </Specimen>
        <Specimen label="linked (href)" bare>
          <MarketingEventCard event={EVENT} href="/dev/components" className="w-full max-w-sm" />
        </Specimen>
        <Specimen label="clickable (onClick)" bare>
          <MarketingEventCard event={FREE_EVENT} onClick={() => {}} className="w-full max-w-sm" />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="CopyCode" spec="§2.10" min="14rem">
        <Specimen label="default (click to copy)">
          <CopyCode code="UXHUB-2026" />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="SuccessOverlay"
        description="Full-screen scrim and card, drawn inside a frame."
        min="100%"
      >
        <Specimen label="default" bare>
          <SuccessOverlayFrame />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="ConfirmDialog"
        spec="§3.7, §2.9"
        description="Plain, typed challenge, pending and error. In the typed one, type a wrong value for the mismatch state and uxathon-2026 for the match. Portaled, so check each in theme=light and theme=dark, and on the mobile preset for the fullscreen layout."
        min="14rem"
      >
        <ConfirmDialogs open={open} />
      </SpecimenGroup>
    </div>
  );
}

const section: GallerySection = {
  id: "composites",
  title: "Shared composites",
  group: "Composites",
  description: "Shared building blocks: BackButton, PageContainer, CopyCode, SuccessOverlay and ConfirmDialog.",
  spec: "§3.5, §3.7, §4.5",
  layout: "split",
  openStates: OPEN_STATES,
  Component: Composites,
};

export default section;
