"use client";

import { CalendarCheck, House, Users } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

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

function SidebarDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Sidebar rows"
        spec="§3.4"
        description="Row states: default, selected with a badge, disabled. 44px rows, 20px icons in text/secondary with a 12px gap, no weight change when selected."
        min="18rem"
      >
        <Specimen label="Default, selected + badge, disabled" bare>
          <RowStates />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SidebarDemo;
