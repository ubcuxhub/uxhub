"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

function SheetDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Sheet"
        spec="§3.15"
        description="Side drawers. The sidebar uses the left sheet on phones."
      >
        <Specimen label="Sheet · right (?open=sheet-right)">
          <Sheet defaultOpen={open === "sheet-right"}>
            <SheetTrigger asChild>
              <Button variant="outline">Open right sheet</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Narrow the list of events.</SheetDescription>
              </SheetHeader>
              <div className="px-4 text-small text-muted-foreground">
                Sheet body content.
              </div>
              <SheetFooter>
                <Button>Apply</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </Specimen>
        <Specimen label="Sheet · left (?open=sheet-left)">
          <Sheet defaultOpen={open === "sheet-left"}>
            <SheetTrigger asChild>
              <Button variant="outline">Open left sheet</Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>Navigation drawer.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SheetDemo;
