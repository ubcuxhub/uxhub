"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GeneralSettings() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Log out</p>
          <p className="text-sm text-muted-foreground">
            Sign out of your UX Hub account on this device.
          </p>
        </div>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut />
          Logout
        </Button>
      </div>
    </div>
  );
}
