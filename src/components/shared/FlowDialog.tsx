"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FlowDialogMode = "canonical" | "intercepted";

interface FlowDialogContextValue {
  busy: boolean;
  close: () => void;
  setBusy: (busy: boolean) => void;
}

const FlowDialogContext = createContext<FlowDialogContextValue>({
  busy: false,
  close: () => undefined,
  setBusy: () => undefined,
});

export function useFlowDialog() {
  return useContext(FlowDialogContext);
}

function safeReturnPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

interface FlowDialogProps {
  children: React.ReactNode;
  description: string;
  mode: FlowDialogMode;
  title: string;
  closeFallback?: string;
  className?: string;
}

export function FlowDialog({
  children,
  description,
  mode,
  title,
  closeFallback = "/portal",
  className,
}: FlowDialogProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (busy) return;

    if (mode === "intercepted") {
      router.back();
      return;
    }

    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    router.replace(safeReturnPath(returnTo, closeFallback));
  }, [busy, closeFallback, mode, router]);

  const contextValue = useMemo(
    () => ({ busy, close, setBusy }),
    [busy, close],
  );

  return (
    <FlowDialogContext.Provider value={contextValue}>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          size="large"
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            className,
          )}
          closeDisabled={busy}
          closeLabel={busy ? "Please wait" : "Close"}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </FlowDialogContext.Provider>
  );
}
