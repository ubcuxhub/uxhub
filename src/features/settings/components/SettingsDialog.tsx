"use client";

import { useEffect, useState } from "react";
import { Receipt, SlidersHorizontal, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { GeneralSettings } from "./GeneralSettings";
import { ProfileSettings } from "./ProfileSettings";
import { PurchaseHistorySettings } from "./PurchaseHistorySettings";

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
        window.location.pathname + window.location.search
      );
    }
  };

  return (
    <Dialog open={tab !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[1000px] [&>button]:hidden">
        <DialogTitle className="sr-only">Profile & settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile and account settings.
        </DialogDescription>
        <SidebarProvider className="min-h-0">
          <Sidebar collapsible="none" className="flex w-48 bg-transparent">
            <SidebarHeader className="shrink-0 flex-row items-center p-3">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X />
                </Button>
              </DialogClose>
            </SidebarHeader>
            <SidebarContent>
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

          <main className="flex h-[80vh] max-h-[760px] flex-1 flex-col overflow-hidden">
            <header className="flex h-[3.75rem] shrink-0 items-center px-6">
              <h2 className="text-base font-semibold">
                {TABS.find((t) => t.id === tab)?.label ?? "Settings"}
              </h2>
            </header>
            <div className="flex-1 overflow-y-auto p-6">
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
