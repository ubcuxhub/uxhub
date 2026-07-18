"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

import { useUser } from "@/context/UserContext";
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
} from "@/components/ui/sidebar";

const studentItems = [
  { title: "Home", href: "/portal", icon: Home, exact: true },
  { title: "Events", href: "/portal/events", icon: CalendarDays },
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
  const isActive = useIsActive();
  const isAdmin = user?.role_access === "admin";

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <Link href="/portal" className="px-2 py-1 text-h3">
          UBC UX Hub
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="p-3">
          <SidebarGroupContent>
            <SidebarMenu>
              {studentItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href, item.exact)}
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
          <SidebarGroup className="p-3">
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin", true)}
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
                    className="h-9"
                  >
                    <Link href="/admin/users">
                      <Users />
                      <span>Manage Users</span>
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
              className="h-9"
            >
              <Settings />
              <span>Profile &amp; settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SettingsDialog />
    </Sidebar>
  );
}
