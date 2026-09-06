"use client";

import { useEffect, useState } from "react";
import { Receipt, SlidersHorizontal, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { GeneralSettings } from "./GeneralSettings";
import { ProfileSettings } from "./ProfileSettings";
import { PurchaseHistorySettings } from "./PurchaseHistorySettings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SettingsTab = "general" | "profile" | "purchases";

const HASH_PREFIX = "#settings/";

const TABS: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof User;
}> = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "profile", label: "Profile", icon: User },
  { id: "purchases", label: "Purchase history", icon: Receipt },
];

/** Open the settings dialog to a given tab from anywhere (updates the hash). */
export function openSettings(tab: SettingsTab = "general") {
  window.location.hash = `settings/${tab}`;
}

function parseHash(): SettingsTab | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const tab = hash.slice(HASH_PREFIX.length);
  return TABS.some((t) => t.id === tab) ? (tab as SettingsTab) : null;
}

/**
 * Project-level settings dialog. Fully driven by the URL hash
 * (`#settings/<tab>`), so it deep-links and survives reloads. Renders nothing
 * until the hash matches, which keeps its heavier subtree unmounted while
 * closed.
 */
export function SettingsDialog() {
  // `null` means closed; a tab id means open on that tab.
  const [tab, setTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    const sync = () => setTab(parseHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    // replaceState (not the hash setter) so tab switches don't stack history.
    window.history.replaceState(null, "", `${HASH_PREFIX}${next}`);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTab(null);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  };

  return (
    <Dialog open={tab !== null} onOpenChange={handleOpenChange}>
      <DialogContent
        size="large"
        className="flex h-svh w-screen max-w-none overflow-hidden rounded-none border-0 p-0 sm:h-[80vh] sm:w-[calc(100vw-1rem)] sm:max-w-[1000px] sm:rounded-lg sm:border"
      >
        <DialogTitle className="sr-only">Profile & settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile and account settings.
        </DialogDescription>

        <SidebarProvider className="h-full min-h-0 w-full">
          <Sidebar
            collapsible="none"
            className="hidden w-48 bg-transparent sm:flex"
          >
            <SidebarContent className="pt-8">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {TABS.map((t) => (
                      <SidebarMenuItem key={t.id}>
                        <SidebarMenuButton
                          isActive={tab === t.id}
                          onClick={() => selectTab(t.id)}
                        >
                          <t.icon />
                          <span>{t.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex shrink-0 flex-col gap-4 border-b px-4 py-4 pr-14 sm:border-b-0 sm:px-6 sm:py-6 sm:pr-16">
              <h2 className="text-subheading">
                {TABS.find((t) => t.id === tab)?.label ?? "Settings"}
              </h2>

              <nav
                aria-label="Settings sections"
                className="flex flex-wrap gap-2 sm:hidden"
              >
                {TABS.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant="ghost"
                    onClick={() => selectTab(t.id)}
                    aria-current={tab === t.id ? "page" : undefined}
                    className={cn(
                      "h-9 min-w-0 flex-none gap-2 px-3 text-small [&_svg]:size-4",
                      tab === t.id && "bg-accent text-accent-foreground",
                    )}
                  >
                    <t.icon />
                    <span className="truncate">{t.label}</span>
                  </Button>
                ))}
              </nav>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 sm:pt-0">
              {tab === "general" && <GeneralSettings />}
              {tab === "profile" && <ProfileSettings />}
              {tab === "purchases" && <PurchaseHistorySettings />}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
