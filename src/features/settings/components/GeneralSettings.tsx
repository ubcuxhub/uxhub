"use client";

import { useSyncExternalStore } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-table">Dark mode</p>
          <p className="text-small text-muted-foreground">
            Switch between light and dark themes on this device.
          </p>
        </div>
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
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-table">Log out</p>
          <p className="text-small text-muted-foreground">
            Sign out of your UX Hub account on this device.
          </p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut />
          Logout
        </Button>
      </div>
    </div>
  );
}
