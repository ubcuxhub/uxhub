"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Hubbo, HUBBO_EMOTIONS, type HubboSize } from "@/components/shared/Hubbo";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const SIZES: HubboSize[] = ["hero", "card", "inline", "head"];

function HubboDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Hubbo"
        spec="§5.2"
        description="Sized by height: hero 240px and card 120px show full-body art; inline 32px and head 40px show head-only art. Each pose keeps its own aspect ratio."
      >
        {HUBBO_EMOTIONS.map((emotion) => (
          <Specimen key={emotion} label={emotion}>
            <div className="flex w-full flex-wrap items-end gap-4">
              {SIZES.map((size) => (
                <Hubbo key={size} emotion={emotion} size={size} />
              ))}
            </div>
          </Specimen>
        ))}
      </SpecimenGroup>

      <Composition
        title="Hubbo on the approved backgrounds"
        description="§5.2: full-body and head-only art on white, #F4F4F4, light purple #F4EAFE and #111111. Check that the edges stay clean on each."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["White", "#FFFFFF"],
            ["Grey", "#F4F4F4"],
            ["Light purple", "#F4EAFE"],
            ["Black", "#111111"],
          ].map(([name, colour]) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-4"
              style={{ backgroundColor: colour }}
            >
              <div className="flex flex-col items-center gap-3">
                <Hubbo emotion="proud" size="card" />
                <Hubbo emotion="proud" size="head" />
              </div>
              <span
                className="text-label"
                style={{ color: colour === "#111111" ? "#FFFFFF" : "#111111" }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </Composition>

      <Composition
        title="Hubbo in an empty state"
        description="Card size above the copy, passed to EmptyState’s media slot. One per screen, never on payments or rejections."
      >
        <div className="max-w-md rounded-xl border border-border bg-card">
          <EmptyState
            size="card"
            media={<Hubbo emotion="resting" size="card" />}
            title="No upcoming events"
            description="We’re planning the next one. Check back soon."
            actions={
              <Button variant="secondary" size="sm">
                View past events
              </Button>
            }
          />
        </div>
      </Composition>
    </div>
  );
}

export default HubboDemo;
