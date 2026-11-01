"use client";

import { useRef, useState } from "react";
import {
  CalendarPlus,
  Copy,
  Ellipsis,
  Link2,
  Mail,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = ["menu", "menu-confirm"] as const;

/**
 * The documented pattern: an icon-button trigger, destructive item last after a
 * separator, and its `onSelect` opening a ConfirmDialog that sits outside the
 * menu. The menu skips its own focus return while the dialog is open, and the
 * dialog hands focus back to the trigger when it closes.
 */
function EventActionsMenu({
  defaultOpen = false,
  defaultConfirmOpen = false,
}: {
  defaultOpen?: boolean;
  defaultConfirmOpen?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(defaultConfirmOpen);
  const [pinned, setPinned] = useState(true);

  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={triggerRef} label="Actions for UXathon">
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => {
            if (confirmOpen) event.preventDefault();
          }}
        >
          <DropdownMenuLabel>UXathon 2026</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Pencil aria-hidden />
              Edit event
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy aria-hidden />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CalendarPlus aria-hidden />
              Add to calendar
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
            Pin to dashboard
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 aria-hidden />
              Share
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>
                <Link2 aria-hidden />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail aria-hidden />
                Email
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            Delete event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          // The dialog has no trigger of its own, so give focus back by hand
          // once Radix has finished unmounting it.
          if (!next) setTimeout(() => triggerRef.current?.focus(), 0);
        }}
        title="Delete UXathon?"
        description="Registrations and tickets for this event are removed. This can't be undone."
        cancelLabel="Keep event"
        confirmLabel="Delete event"
        onConfirm={() => setConfirmOpen(false)}
      />
    </>
  );
}

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

function TabsAndMenus({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Tabs"
        spec="§3.4"
        description="Pill tabs for the sections of one object. Counts are secondary text and part of the accessible name. Left/Right, Home/End; Tab moves into the panel."
        min="16rem"
      >
        <Specimen label="Object tabs with counts, in a Card" bare wide>
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

      <SpecimenGroup
        title="DropdownMenu"
        spec="§3.7"
        description="Every admin action on an object. Enter, Space or Down opens; arrows move, typing jumps, Esc closes and returns focus. Destructive items go last, after a separator, and open a ConfirmDialog. Force a state with ?open=."
        min="14rem"
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

const section: GallerySection = {
  id: "tabs-and-menus",
  title: "Tabs and menus",
  group: "Navigation",
  description: "Tabs switch between parts of one object; a DropdownMenu holds its less common actions.",
  spec: "§3.4, §3.7",
  layout: "split",
  openStates: OPEN_STATES,
  Component: TabsAndMenus,
};

export default section;
