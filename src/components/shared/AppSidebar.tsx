"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  House,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { useUser } from "@/lib/auth/user-context";
import { FLAGS } from "@/lib/flags";
import { hasAdminAccess, hasManagerAccess } from "@/lib/auth/roles";
import {
  SettingsDialog,
  openSettings,
} from "@/features/settings/components/SettingsDialog";
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
  { title: "Home", href: "/portal", icon: House, exact: true },
  ...(FLAGS.studentEvents
    ? [{ title: "Events", href: "/portal/events", icon: Calendar }]
    : []),
];

export function AppSidebar() {
  const { user } = useUser();

  return (
    <AppSidebarNav
      isAdmin={hasAdminAccess(user?.role_access)}
      isManager={hasManagerAccess(user?.role_access)}
    />
  );
}

/**
 * The sidebar as a view of two flags. `AppSidebar` derives them from the
 * signed-in user; the dev gallery passes fixtures. `pathname` overrides the
 * current route so a fixture can show a selected row.
 */
export function AppSidebarNav({
  isAdmin,
  isManager,
  pathname: pathnameOverride,
}: {
  isAdmin: boolean;
  isManager: boolean;
  pathname?: string;
}) {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;
  // Index routes (e.g. /portal, /admin) are prefixes of every child route, so
  // they must match exactly; deeper routes match by prefix so child pages keep
  // their tab highlighted.
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const collapsed = state === "collapsed" && !isMobile;
  const toggleLabel = collapsed ? "Expand Sidebar" : "Collapse Sidebar";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-6 pt-10 pb-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          href="/portal"
          aria-label="UBC UX Hub"
          className="block size-9 rounded-md transition-[width,height] duration-200 ease-out focus-visible:focus-ring group-data-[collapsible=icon]:size-8"
        >
          <Image
            src="/icons/icon-dark.svg"
            alt=""
            width={36}
            height={36}
            className="size-full dark:hidden"
            priority
          />
          <Image
            src="/icons/icon-light.svg"
            alt=""
            width={36}
            height={36}
            className="hidden size-full dark:block"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="p-3 group-data-[collapsible=icon]:px-0">
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studentItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href, item.exact)}
                    tooltip={item.title}
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
          <SidebarGroup className="p-3 group-data-[collapsible=icon]:px-0">
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin", true)}
                    tooltip="Dashboard"
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
                  >
                    <Link href="/admin/events">
                      <CalendarCheck />
                      <span>Manage Events</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/users")}
                    tooltip="Manage Users"
                  >
                    <Link href="/admin/users">
                      <Users />
                      <span>Manage Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {isManager && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/admin/settings")}
                      tooltip="Club Settings"
                    >
                      <Link href="/admin/settings">
                        <SlidersHorizontal />
                        <span>Club Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => openSettings()} tooltip="Settings">
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={toggleLabel}
              aria-label={toggleLabel}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              <span>{toggleLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SettingsDialog />
    </Sidebar>
  );
}
