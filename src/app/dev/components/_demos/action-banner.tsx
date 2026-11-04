"use client";

import { Calendar } from "lucide-react";

import { ActionBanner } from "@/components/ui/action-banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function ActionBannerDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        surface="page"
        title="ActionBanner"
        spec="§3.8, §4.3"
        description="At the top of Home or an event page, one at a time. The button names the step. Not an alert: it is present at load and does not interrupt."
      >
        <Specimen label="Accepted, with action" wide>
          <ActionBanner
            className="w-full"
            title="You’re accepted to Design Sprint."
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14.
          </ActionBanner>
        </Specimen>
        <Specimen label="Join banner" wide>
          <ActionBanner
            className="w-full"
            title="Become a member"
            action={<Button size="sm">Join UX Hub</Button>}
          >
            Get member pricing and priority on event applications.
          </ActionBanner>
        </Specimen>
        <Specimen label="No action" wide>
          <ActionBanner className="w-full" title="Application submitted.">
            We’ll email you when decisions are out.
          </ActionBanner>
        </Specimen>
        <Specimen label="Long copy" wide>
          <ActionBanner
            className="w-full"
            title="You’re accepted to the UXathon 2026 design sprint with a very long title that wraps"
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14 at 11:59 PM Pacific, or we’ll offer it
            to the next person on the waitlist.
          </ActionBanner>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Banner above an empty list"
        description="The page keeps its title, the banner sits on top, and the empty state fills the card."
      >
        <div className="flex flex-col gap-4">
          <ActionBanner
            title="You’re accepted to Design Sprint."
            action={<Button size="sm">Confirm spot</Button>}
          >
            Confirm your spot by Nov 14.
          </ActionBanner>
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
            />
          </div>
        </div>
      </Composition>
    </div>
  );
}

export default ActionBannerDemo;
