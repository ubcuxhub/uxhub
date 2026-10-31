"use client";

import { Calendar, CalendarDays, Home, LayoutDashboard, Users } from "lucide-react";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shared/AppSidebar";
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

import { Composition, Placeholder, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

/**
 * The sidebar positions itself with `position: fixed`. A transform on the
 * frame makes it the containing block, so the sidebar sits inside the frame
 * instead of the viewport; the container and wrapper sizes are pinned to the
 * frame for the same reason.
 */
function SidebarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[640px] overflow-hidden rounded-xl border [transform:translateZ(0)] [&_[data-slot=sidebar-container]]:h-full! [&_[data-slot=sidebar-wrapper]]:h-full [&_[data-slot=sidebar-wrapper]]:min-h-0!">
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
          <h3 className="text-h2">Events</h3>
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

/**
 * Admin items built from the same primitives as AppSidebar. `AppSidebar`
 * reads `useUser()` and the gallery has no signed-in user, so the admin group
 * can't be shown through it; PR 5 extracts `AppSidebarNav` and replaces this.
 */
function AdminItemsReplica() {
  return (
    <SidebarProvider className="min-h-0 w-full">
      <Sidebar collapsible="none" className="w-64 rounded-xl border">
        <SidebarContent>
          <SidebarGroup className="p-3">
            <SidebarGroupLabel className="uppercase">Browse</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <Home />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <CalendarDays />
                    <span>Events</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="p-3">
            <SidebarGroupLabel className="uppercase">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <Calendar />
                    <span>Manage Events</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Users />
                    <span>Manage Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Users />
                    <span>Disabled item</span>
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
        title="Sidebar rows"
        spec="§3.4"
        description="Menu button states, group labels (uppercase today) and a badge. Selected rows use data-active."
        min="18rem"
      >
        <Specimen label="Browse + Admin groups, selected and disabled rows" bare wide>
          <AdminItemsReplica />
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Sidebar"
        description="AppSidebar in its current form, expanded and collapsed (icons only), inside a framed shell. Signed out, so the Admin group is absent."
      >
        <div className="grid gap-6">
          <Specimen label="Expanded" bare>
            <div className="w-full">
              <SidebarFrame>
                <SidebarProvider defaultOpen>
                  <AppSidebar />
                  <PageBody />
                </SidebarProvider>
              </SidebarFrame>
            </div>
          </Specimen>
          <Specimen label="Collapsed (icon rail)" bare>
            <div className="w-full">
              <SidebarFrame>
                <SidebarProvider defaultOpen={false}>
                  <AppSidebar />
                  <PageBody />
                </SidebarProvider>
              </SidebarFrame>
            </div>
          </Specimen>
        </div>
        <Placeholder>
          AppSidebar reads useUser(), and a nested UserProvider can’t fake an
          admin, so the Admin group isn’t shown here. PR 5 extracts a
          prop-driven AppSidebarNav for that.
        </Placeholder>
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
