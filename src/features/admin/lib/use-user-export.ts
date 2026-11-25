"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

export function useUserExport() {
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const toastId = useRef<string | number | undefined>(undefined);
  useEffect(() => () => {
    active.current?.abort();
    if (toastId.current !== undefined) toast.dismiss(toastId.current);
  }, []);

  async function download() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    // A fresh ID keeps the toast retry button's dismissal from hiding progress.
    toastId.current = toast("Preparing user data…", { duration: Infinity });
    try {
      const response = await fetch("/api/admin/users/export", { cache: "no-store", signal: controller.signal });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("text/csv")) throw new Error("Export unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "uxhub-users.csv";
      try {
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast.success("CSV download started", { id: toastId.current });
    } catch {
      if (!controller.signal.aborted) toast.error("Couldn’t export user data", {
        id: toastId.current,
        description: "Check your connection and staff access, then try again.",
        action: { label: "Try again", onClick: () => { void download(); } },
      });
    } finally {
      if (!controller.signal.aborted) { active.current = null; setPending(false); }
    }
  }
  return { pending, download };
}
