"use client";

import { Info, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

function TooltipDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Tooltip" spec="§3.7" min="14rem">
        <Specimen label="Tooltip (?open=tooltip)">
          <div className="flex gap-2">
            <Tooltip defaultOpen={open === "tooltip"}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More info">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Registration closes Nov 1
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Delete">
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete (opens after 300ms on hover)</TooltipContent>
            </Tooltip>
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TooltipDemo;
