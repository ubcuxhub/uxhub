"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { EventActionsMenu } from "./_fixtures/event-actions-menu";

function TabsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Tabs"
        spec="§3.4"
        description="Pill tabs for the sections of one object. Counts are secondary text and part of the accessible name. Left/Right, Home/End; Tab moves into the panel."
      >
        <Specimen label="Object tabs with counts, in a Card" wide>
          <Card className="w-full min-w-0 gap-4">
            <CardHeader>
              <CardTitle>UXathon 2026</CardTitle>
              <CardDescription>Nov 14–15 · ICICS</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList aria-label="Event sections">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="registrations" count={128}>
                    Registrations
                  </TabsTrigger>
                  <TabsTrigger value="teams" count={32}>
                    Teams
                  </TabsTrigger>
                  <TabsTrigger value="judges">Judges</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="text-small">
                  Venue, schedule and the registration window.
                </TabsContent>
                <TabsContent value="registrations" className="text-small">
                  128 students have registered.
                </TabsContent>
                <TabsContent value="teams" className="text-small">
                  32 teams of up to four.
                </TabsContent>
                <TabsContent value="judges" className="text-small">
                  No judges assigned yet.
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Specimen>

        <Specimen label="Agenda weeks">
          <Tabs defaultValue="week-2">
            <TabsList aria-label="Agenda weeks">
              <TabsTrigger value="week-1">Week 1</TabsTrigger>
              <TabsTrigger value="week-2">Week 2</TabsTrigger>
              <TabsTrigger value="week-3">Week 3</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>

        <Specimen label="Disabled tab">
          <Tabs defaultValue="overview">
            <TabsList aria-label="Event sections, one unavailable">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="teams" count={0} disabled>
                Teams
              </TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>

        <Specimen label="Overflow: scrolls sideways in a narrow container">
          <div className="w-64 max-w-full">
            <Tabs defaultValue="overview">
              <TabsList aria-label="Many sections">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="registrations" count={128}>
                  Registrations
                </TabsTrigger>
                <TabsTrigger value="teams" count={32}>
                  Teams
                </TabsTrigger>
                <TabsTrigger value="judges">Judges</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Object header"
        description="Tabs and the actions menu together, as an edit drawer or object page would use them."
      >
        <Card className="gap-0 py-0">
          <div className="flex items-start justify-between gap-4 p-4 sm:p-6">
            <div>
              <h4 className="text-subheading">UXathon 2026</h4>
              <p className="text-small text-muted-foreground">
                Nov 14–15 · ICICS
              </p>
            </div>
            <EventActionsMenu />
          </div>
          <div className="border-t border-border-subtle px-3 py-2 sm:px-5">
            <Tabs defaultValue="registrations">
              <TabsList aria-label="Event sections, header">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="registrations" count={128}>
                  Registrations
                </TabsTrigger>
                <TabsTrigger value="teams" count={32}>
                  Teams
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>
      </Composition>
    </div>
  );
}

export default TabsDemo;
