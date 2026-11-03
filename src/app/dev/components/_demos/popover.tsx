"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

function PopoverDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Popover" spec="§3.7">
        <Specimen label="Popover (?open=popover)">
          <Popover defaultOpen={open === "popover"}>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <PopoverHeader>
                <PopoverTitle>Date range</PopoverTitle>
                <PopoverDescription>
                  Choose when registration opens.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default PopoverDemo;
