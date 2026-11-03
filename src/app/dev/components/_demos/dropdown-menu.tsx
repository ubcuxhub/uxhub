"use client";

import { useState } from "react";
import { Ellipsis } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

import { EventActionsMenu } from "./_fixtures/event-actions-menu";

function SortMenu() {
  const [sort, setSort] = useState("date");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Sort events" variant="ghost">
          <Ellipsis />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="registrations">
            Registrations
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownMenuDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="DropdownMenu"
        spec="§3.7"
        description="Every admin action on an object. Enter, Space or Down opens; arrows move, typing jumps, Esc closes and returns focus. Destructive items go last, after a separator, and open a ConfirmDialog. Force a state with ?open=."
      >
        <Specimen label="Actions menu (?open=menu)">
          <EventActionsMenu defaultOpen={open === "menu"} />
        </Specimen>
        <Specimen label="Delete confirmation (?open=menu-confirm)">
          <EventActionsMenu defaultConfirmOpen={open === "menu-confirm"} />
        </Specimen>
        <Specimen label="Radio items">
          <SortMenu />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default DropdownMenuDemo;
