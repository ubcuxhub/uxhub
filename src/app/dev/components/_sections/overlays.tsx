"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = [
  "dialog",
  "dialog-large",
  "dialog-mobile",
  "dialog-delete",
  "sheet-right",
  "sheet-left",
  "popover",
  "tooltip",
] as const;

function Overlays({ open }: SectionProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-8">
        <SpecimenGroup
          title="Dialog"
          spec="§3.7"
          description="Default, large (settings and checkout flows) and mobileFullscreen (ConfirmDialog). Open with the buttons, or force one with ?open=. Check each in theme=light and theme=dark, and on the mobile preset."
          min="14rem"
        >
          <Specimen label="Dialog · default (?open=dialog)">
            <Dialog defaultOpen={open === "dialog"}>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit event details</DialogTitle>
                  <DialogDescription>
                    Changes are visible to students as soon as you save.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="dialog-name">Event name</Label>
                  <Input id="dialog-name" defaultValue="UXathon 2026" />
                </div>
                <DialogFooter className="gap-3 sm:gap-0">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Specimen>

          <Specimen label='Dialog · size="large" (?open=dialog-large)'>
            <Dialog defaultOpen={open === "dialog-large"}>
              <DialogTrigger asChild>
                <Button variant="outline">Open large dialog</Button>
              </DialogTrigger>
              <DialogContent size="large">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>
                    Fills the viewport on phones, 1000px wide on desktop.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto text-small text-muted-foreground">
                  {Array.from({ length: 24 }, (_, i) => (
                    <p key={i} className="py-1">
                      Row {i + 1}. Long content scrolls inside a large dialog.
                    </p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </Specimen>

          <Specimen label="Dialog · mobileFullscreen (?open=dialog-mobile)">
            <Dialog defaultOpen={open === "dialog-mobile"}>
              <DialogTrigger asChild>
                <Button variant="outline">Open fullscreen on mobile</Button>
              </DialogTrigger>
              <DialogContent mobileFullscreen>
                <DialogHeader className="border-b pb-5 pl-5 pr-20 pt-16 text-left sm:border-0 sm:p-0">
                  <DialogTitle>Fullscreen on mobile</DialogTitle>
                  <DialogDescription>
                    Below 640px this fills the screen.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-auto gap-3 border-t p-5 sm:mt-0 sm:gap-0 sm:border-0 sm:p-0 [&>button]:w-full sm:[&>button]:w-auto">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Continue</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Specimen>
        </SpecimenGroup>

        <SpecimenGroup
          title="Sheet"
          spec="§3.15"
          description="Side drawers. The sidebar uses the left sheet on phones."
          min="14rem"
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

        <SpecimenGroup title="Popover and Tooltip" spec="§3.7" min="14rem">
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
          <Specimen label="Tooltip (?open=tooltip)">
            <Tooltip defaultOpen={open === "tooltip"}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More info">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Registration closes Nov 1
              </TooltipContent>
            </Tooltip>
          </Specimen>
        </SpecimenGroup>

        <Composition
          title="Dialog"
          description="A destructive confirmation as the admin pages ask for it (?open=dialog-delete)."
        >
          <div>
            <Dialog defaultOpen={open === "dialog-delete"}>
              <DialogTrigger asChild>
                <Button variant="destructive">Delete event</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete UXathon?</DialogTitle>
                  <DialogDescription>
                    This removes the event, its 48 registrations and all
                    applications. Attendees are not notified, and this can’t be
                    undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-3 sm:gap-0">
                  <DialogClose asChild>
                    <Button variant="outline">Keep event</Button>
                  </DialogClose>
                  <Button variant="destructive">Delete event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Composition>
      </div>
    </TooltipProvider>
  );
}

const section: GallerySection = {
  id: "overlays",
  title: "Overlays",
  spec: "§3.7, §2.6",
  layout: "page",
  openStates: OPEN_STATES,
  Component: Overlays,
};

export default section;
