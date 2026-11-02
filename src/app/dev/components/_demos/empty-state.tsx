"use client";

import { Calendar, CalendarX, CloudOff, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function Framed({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border">{children}</div>
  );
}

function EmptyStateDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="EmptyState"
        spec="§3.8, §4.4f"
        min="min(22rem, 100%)"
        description="Say what goes here and offer the next step. No error colours, no blame, even when loading failed."
      >
        <Specimen label="card (default), empty" bare>
          <Framed>
            <EmptyState
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
              actions={
                <Button variant="secondary" size="sm">
                  View past events
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, no results" bare>
          <Framed>
            <EmptyState
              icon={<SearchX />}
              title="No events match “portfolo”"
              description="Check the spelling or try a different word."
              actions={
                <Button variant="secondary" size="sm">
                  Clear search
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, load failed" bare>
          <Framed>
            <EmptyState
              icon={<CloudOff />}
              title="Couldn’t load events"
              description="Check your connection and try again."
              actions={
                <Button variant="secondary" size="sm">
                  Try again
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="card, not found" bare>
          <Framed>
            <EmptyState
              icon={<CalendarX />}
              title="This event isn’t available"
              description="It may have been removed, or the link is wrong."
              actions={
                <Button variant="secondary" size="sm">
                  Back to Events
                </Button>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="page (py-16), two actions" bare wide>
          <Framed>
            <EmptyState
              size="page"
              titleAs="h2"
              icon={<Calendar />}
              title="No upcoming events"
              description="New events show up here as soon as they’re published."
              actions={
                <>
                  <Button size="sm">Browse past events</Button>
                  <Button variant="secondary" size="sm">
                    Subscribe
                  </Button>
                </>
              }
            />
          </Framed>
        </Specimen>
        <Specimen label="inline (no media)" bare>
          <Framed>
            <EmptyState
              size="inline"
              title="Nothing on right now"
              description="Check back during the event."
            />
          </Framed>
        </Specimen>
        <Specimen label="inline, title only" bare>
          <Framed>
            <EmptyState size="inline" title="No applications yet" />
          </Framed>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default EmptyStateDemo;
