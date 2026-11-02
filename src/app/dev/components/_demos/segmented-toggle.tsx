"use client";

import { useState } from "react";
import { CalendarClock, History, LayoutList } from "lucide-react";

import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function ControlledToggle() {
  const [value, setValue] = useState("upcoming");
  return (
    <div className="flex flex-col gap-2">
      <SegmentedToggle aria-label="Show events" value={value} onValueChange={setValue}>
        <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
        <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
      </SegmentedToggle>
      <span className="text-label text-muted-foreground">value: {value}</span>
    </div>
  );
}

function SegmentedToggleDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="SegmentedToggle"
        spec="§3.2"
        description="Two or three options that switch a view and never submit. The selected option can’t be deselected. Arrows move focus; Space or Enter selects."
        min="17rem"
      >
        <Specimen label="Upcoming / Past, controlled">
          <ControlledToggle />
        </Specimen>
        <Specimen label="three options">
          <SegmentedToggle aria-label="Application view" defaultValue="all">
            <SegmentedToggleItem value="all">All</SegmentedToggleItem>
            <SegmentedToggleItem value="mine">Assigned to me</SegmentedToggleItem>
            <SegmentedToggleItem value="done">Reviewed</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="with icons">
          <SegmentedToggle aria-label="Event layout" defaultValue="timeline">
            <SegmentedToggleItem value="timeline">
              <CalendarClock aria-hidden />
              Timeline
            </SegmentedToggleItem>
            <SegmentedToggleItem value="list">
              <LayoutList aria-hidden />
              List
            </SegmentedToggleItem>
            <SegmentedToggleItem value="past">
              <History aria-hidden />
              Past
            </SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="one option disabled">
          <SegmentedToggle aria-label="Event layout, one disabled" defaultValue="upcoming">
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
            <SegmentedToggleItem value="drafts" disabled>
              Drafts
            </SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="all disabled">
          <SegmentedToggle aria-label="Disabled toggle" defaultValue="upcoming" disabled>
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
        <Specimen label="className=&quot;w-full&quot;: options share the width" wide>
          <SegmentedToggle
            aria-label="Full width toggle"
            defaultValue="upcoming"
            className="w-full sm:max-w-sm"
          >
            <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
            <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
          </SegmentedToggle>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SegmentedToggleDemo;
