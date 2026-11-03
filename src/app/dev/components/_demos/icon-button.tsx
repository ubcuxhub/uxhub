"use client";

import { Pencil, Plus, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function IconButtonDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="IconButton"
        spec="§3.1"
        description="An icon-only Button whose label is both the accessible name and the tooltip, so nobody has to guess what the icon means."
      >
        <Specimen label="IconButton (hover for tooltip)">
          <IconButton label="Edit user">
            <Pencil />
          </IconButton>
          <IconButton label="Close" variant="ghost">
            <X />
          </IconButton>
          <IconButton label="Close" size="icon-sm">
            <X />
          </IconButton>
          <IconButton label="Add" disabled>
            <Plus />
          </IconButton>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default IconButtonDemo;
