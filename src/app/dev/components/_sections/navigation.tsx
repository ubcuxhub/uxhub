"use client";

import { CalendarCheck, House, Users } from "lucide-react";
import type { ReactNode } from "react";

import { AppSidebarNav } from "@/components/shared/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

/**
 * The sidebar positions itself with `position: fixed`. A transform on the
 * frame makes it the containing block, so the sidebar sits inside the frame
 * instead of the viewport; the container and wrapper sizes are pinned to the
 * frame for the same reason.
 */
function SidebarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[680px] overflow-hidden rounded-xl border [transform:translateZ(0)] [&_[data-slot=sidebar-container]]:h-full! [&_[data-slot=sidebar-wrapper]]:h-full [&_[data-slot=sidebar-wrapper]]:min-h-0!">
      {children}
    </div>
  );
}

function PageBody() {
  return (
    <SidebarInset className="min-h-0 overflow-auto">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h3 className="text-h2">Manage Events</h3>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>UXathon 2026</CardTitle>
          </CardHeader>
          <CardContent className="text-small text-muted-foreground">
            Below 768px the sidebar becomes a sheet; the trigger opens it.
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}

/** A sidebar on its own, in a frame as tall as the shell. */
function SidebarOnly({
  defaultOpen = true,
  isAdmin,
  isManager,
  pathname,
}: {
  defaultOpen?: boolean;
  isAdmin: boolean;
  isManager: boolean;
  pathname: string;
}) {
  return (
    <div className="relative h-[680px] w-fit overflow-hidden rounded-xl border [transform:translateZ(0)] [&_[data-slot=sidebar-container]]:h-full! [&_[data-slot=sidebar-wrapper]]:h-full [&_[data-slot=sidebar-wrapper]]:min-h-0!">
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebarNav isAdmin={isAdmin} isManager={isManager} pathname={pathname} />
      </SidebarProvider>
    </div>
  );
}

/**
 * Row states the real sidebar can't show at once: selected, a count badge,
 * disabled. Hover and focus are checked by hand.
 */
function RowStates() {
  return (
    <SidebarProvider className="min-h-0 w-full">
      <Sidebar collapsible="none" className="w-64 rounded-xl border">
        <SidebarContent>
          <SidebarGroup className="p-3">
            <SidebarGroupLabel>Rows</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <House />
                    <span>Default</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <CalendarCheck />
                    <span>Selected</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Users />
                    <span>Disabled</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

function Navigation() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Sidebar"
        spec="§3.4"
        description="AppSidebarNav with fixture flags. Members see Browse; admins add Admin; managers add Club Settings. Collapsed is the 88px icon rail."
        min="18rem"
      >
        <Specimen label="Member · Home selected" bare>
          <SidebarOnly isAdmin={false} isManager={false} pathname="/portal" />
        </Specimen>
        <Specimen label="Admin · Manage Events selected" bare>
          <SidebarOnly isAdmin isManager={false} pathname="/admin/events/new" />
        </Specimen>
        <Specimen label="Manager · Club Settings selected" bare>
          <SidebarOnly isAdmin isManager pathname="/admin/settings" />
        </Specimen>
        <Specimen label="Admin · collapsed (88px)" bare>
          <SidebarOnly
            defaultOpen={false}
            isAdmin
            isManager
            pathname="/admin/users"
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Sidebar rows"
        spec="§3.4"
        description="Row states: default, selected with a badge, disabled. 44px rows, 20px icons in text-secondary with a 12px gap, no weight change when selected."
        min="18rem"
      >
        <Specimen label="Default, selected + badge, disabled" bare>
          <RowStates />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Sidebar"
        description="The shell: AppSidebarNav beside a page title and a card, expanded and collapsed."
      >
        <div className="grid gap-6">
          <Specimen label="Expanded" bare>
            <div className="w-full">
              <SidebarFrame>
                <SidebarProvider defaultOpen>
                  <AppSidebarNav isAdmin isManager pathname="/admin/events" />
                  <PageBody />
                </SidebarProvider>
              </SidebarFrame>
            </div>
          </Specimen>
          <Specimen label="Collapsed (88px icon rail)" bare>
            <div className="w-full">
              <SidebarFrame>
                <SidebarProvider defaultOpen={false}>
                  <AppSidebarNav isAdmin isManager pathname="/admin/events" />
                  <PageBody />
                </SidebarProvider>
              </SidebarFrame>
            </div>
          </Specimen>
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "navigation",
  title: "Navigation",
  spec: "§3.4",
  layout: "split",
  Component: Navigation,
};

export default section;
