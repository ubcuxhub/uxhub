"use client";

import { useSyncExternalStore } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";

import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/client";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DeleteAccountRow } from "./DeleteAccountRow";
import { SettingsRow } from "./SettingsRow";

export function GeneralSettings() {
  const router = useRouter();
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const isDark = theme === "dark";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="flex flex-col">
      {FLAGS.darkMode && (
        <SettingsRow
          title="Dark mode"
          description="Switch between light and dark themes on this device."
        >
          <div className="flex items-center gap-2">
            {isDark ? (
              <Moon className="size-4 text-muted-foreground" />
            ) : (
              <Sun className="size-4 text-muted-foreground" />
            )}
            <Switch
              checked={isDark}
              onCheckedChange={handleThemeChange}
              aria-label="Toggle dark mode"
            />
          </div>
        </SettingsRow>
      )}

      <SettingsRow
        title="Log out"
        description="Sign out of your UX Hub account on this device."
      >
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut />
          Logout
        </Button>
      </SettingsRow>

      <DeleteAccountRow />
    </div>
  );
}
