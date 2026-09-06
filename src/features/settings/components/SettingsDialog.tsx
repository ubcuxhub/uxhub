"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Receipt,
  SlidersHorizontal,
  User,
} from "lucide-react";

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

const SETTINGS_HASH = "#settings";
const HASH_PREFIX = `${SETTINGS_HASH}/`;

const TABS: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof User;
}> = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "profile", label: "Profile", icon: User },
  { id: "purchases", label: "Purchase history", icon: Receipt },
];

/** Open the settings menu, or deep-link directly to a given tab. */
export function openSettings(tab?: SettingsTab) {
  window.location.hash = tab ? `settings/${tab}` : "settings";
}

function parseHash(): { tab: SettingsTab; showMenu: boolean } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (hash === SETTINGS_HASH) return { tab: "general", showMenu: true };
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const tab = hash.slice(HASH_PREFIX.length);
  return TABS.some((t) => t.id === tab)
    ? { tab: tab as SettingsTab, showMenu: false }
    : null;
}

/**
 * Project-level settings dialog. Fully driven by the URL hash
 * (`#settings` or `#settings/<tab>`), so it deep-links and survives reloads.
 * On mobile, the root hash opens a minimal section list before drilling into a
 * tab. Renders nothing until the hash matches, which keeps its heavier subtree
 * unmounted while closed.
 */
export function SettingsDialog() {
  // `null` means closed; a tab id means open on that tab.
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const sync = () => {
      const state = parseHash();
      setTab(state?.tab ?? null);
      setShowMobileMenu(state?.showMenu ?? false);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    setShowMobileMenu(false);
    // replaceState (not the hash setter) so tab switches don't stack history.
    window.history.replaceState(null, "", `${HASH_PREFIX}${next}`);
  };

  const showMenu = () => {
    setShowMobileMenu(true);
    window.history.replaceState(null, "", SETTINGS_HASH);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTab(null);
      setShowMobileMenu(false);
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

          <div
            className={cn(
              "h-full min-w-0 flex-1 flex-col overflow-hidden sm:hidden",
              showMobileMenu ? "flex" : "hidden",
            )}
          >
            <header className="shrink-0 px-5 pb-3 pt-6 pr-14">
              <h2 className="text-subheading">Settings</h2>
            </header>

            <nav
              aria-label="Settings sections"
              className="flex-1 overflow-y-auto px-3 py-2"
            >
              <SidebarMenu>
                {TABS.map((t) => (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      onClick={() => selectTab(t.id)}
                      className="h-12 px-3 [&>svg]:text-foreground"
                    >
                      <t.icon />
                      <span>{t.label}</span>
                      <ChevronRight className="ml-auto size-4!" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </div>

          <main
            className={cn(
              "h-full min-w-0 flex-1 flex-col overflow-hidden sm:flex",
              showMobileMenu ? "hidden" : "flex",
            )}
          >
            <header className="flex shrink-0 items-center gap-2 px-4 py-4 pr-14 sm:px-6 sm:py-6 sm:pr-16">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={showMenu}
                aria-label="Back to settings"
                className="-ml-2 sm:hidden"
              >
                <ArrowLeft />
              </Button>
              <h2 className="text-subheading">
                {TABS.find((t) => t.id === tab)?.label ?? "Settings"}
              </h2>
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
