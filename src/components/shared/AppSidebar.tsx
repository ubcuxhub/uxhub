"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LayoutDashboard,
  PanelLeft,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { useUser } from "@/context/UserContext";
import { FLAGS } from "@/lib/flags";
import { SettingsDialog, openSettings } from "@/features/settings";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const studentItems = [
  { title: "Home", href: "/portal", icon: Home, exact: true },
  ...(FLAGS.studentEvents
    ? [{ title: "Events", href: "/portal/events", icon: CalendarDays }]
    : []),
];

function useIsActive() {
  const pathname = usePathname();
  // Index routes (e.g. /portal, /admin) are prefixes of every child route, so
  // they must match exactly; deeper routes match by prefix so child pages keep
  // their tab highlighted.
  return (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const { user } = useUser();
  const { state, toggleSidebar } = useSidebar();
  const isActive = useIsActive();
  const isAdmin = user?.role_access === "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:hidden">
        <Link href="/portal" aria-label="UBC UX Hub" className="px-2 py-1">
          <Image
            src="/icons/icon-dark.svg"
            alt=""
            width={40}
            height={40}
            className="size-14 dark:hidden"
            priority
          />
          <Image
            src="/icons/icon-light.svg"
            alt=""
            width={40}
            height={40}
            className="hidden size-14 dark:block"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:invisible">
        <SidebarGroup className="p-3 group-data-[collapsible=icon]:p-2">
          <SidebarGroupLabel className="uppercase">Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studentItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href, item.exact)}
                    tooltip={item.title}
                    className="h-9"
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="p-3 group-data-[collapsible=icon]:p-2">
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin", true)}
                    tooltip="Dashboard"
                    className="h-9"
                  >
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/events")}
                    tooltip="Manage Events"
                    className="h-9"
                  >
                    <Link href="/admin/events">
                      <CalendarDays />
                      <span>Manage Events</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/users")}
                    tooltip="Manage Users"
                    className="h-9"
                  >
                    <Link href="/admin/users">
                      <Users />
                      <span>Manage Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/settings")}
                    tooltip="Club Settings"
                    className="h-9"
                  >
                    <Link href="/admin/settings">
                      <SlidersHorizontal />
                      <span>Club Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => openSettings("general")}
              tooltip="Settings"
              className="h-9 group-data-[collapsible=icon]:size-9!"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
              className="h-9 group-data-[collapsible=icon]:size-9!"
            >
              <PanelLeft />
              <span>Collapse sidebar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SettingsDialog />
    </Sidebar>
  );
}
