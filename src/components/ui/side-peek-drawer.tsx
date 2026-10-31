"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsRight, Maximize2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { IconButton } from "@/components/ui/icon-button";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidePeekDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

const SidePeekDrawerContext = React.createContext<{
  requestClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
} | null>(null);

function useSidePeekDrawer() {
  const context = React.useContext(SidePeekDrawerContext);
  if (!context) throw new Error("SidePeekDrawer parts must be inside SidePeekDrawer");
  return context;
}

/** A nonmodal panel: the page remains scrollable and row clicks can swap records. */
function SidePeekDrawer({
  open,
  onOpenChange,
  dirty = false,
  returnFocusRef,
  children,
}: SidePeekDrawerProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const requestClose = React.useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else onOpenChange(false);
  }, [dirty, onOpenChange]);

  return (
    <SidePeekDrawerContext.Provider value={{ requestClose, returnFocusRef }}>
      <DialogPrimitive.Root
        modal={false}
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        {children}
      </DialogPrimitive.Root>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmOpen(false);
          onOpenChange(false);
        }}
      />
    </SidePeekDrawerContext.Provider>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SidePeekDrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, onOpenAutoFocus, onCloseAutoFocus, onKeyDown, onInteractOutside, onPointerDownOutside, children, ...props }, ref) => {
  const { returnFocusRef } = useSidePeekDrawer();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        ref={ref}
        data-slot="side-peek-drawer-content"
        className={cn(
          "safe-area-bleed-y fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col overflow-hidden border-l border-border-subtle bg-popover text-popover-foreground shadow-overlay duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:fade-in-0 sm:w-[560px]",
          className,
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement)
            .querySelector<HTMLElement>('[data-slot="side-peek-drawer-title"]')
            ?.focus();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event);
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Tab") return;
          const content = event.currentTarget;
          const tabbables = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE))
            .filter((item) => item.getAttribute("aria-hidden") !== "true" && item.tabIndex >= 0);
          if (tabbables.length === 0) {
            event.preventDefault();
            content.focus();
            return;
          }
          if (event.shiftKey && document.activeElement === tabbables[0]) {
            event.preventDefault();
            tabbables[tabbables.length - 1].focus();
          } else if (!event.shiftKey && document.activeElement === tabbables[tabbables.length - 1]) {
            event.preventDefault();
            tabbables[0].focus();
          }
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
SidePeekDrawerContent.displayName = "SidePeekDrawerContent";

function SidePeekDrawerHeader({
  fullPageHref,
  actions,
  className,
  ...props
}: React.ComponentProps<"div"> & { fullPageHref?: string; actions?: React.ReactNode }) {
  const { requestClose } = useSidePeekDrawer();
  return (
    <div
      data-slot="side-peek-drawer-header"
      className={cn("flex shrink-0 items-center justify-between border-b border-border-subtle px-6 pb-4 pt-10", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <IconButton variant="ghost" label="Close panel (Esc)" onClick={requestClose} className="rounded-lg text-muted-foreground">
          <ChevronsRight className="size-[18px]" strokeWidth={1.5} />
        </IconButton>
        {fullPageHref ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={fullPageHref}
                aria-label="Open as full page"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-lg text-muted-foreground")}
              >
                <Maximize2 className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Open as full page</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function SidePeekDrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="side-peek-drawer-body" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-8", className)} {...props} />;
}

const SidePeekDrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} data-slot="side-peek-drawer-title" tabIndex={-1} className={cn("text-h2 text-foreground outline-none", className)} {...props} />
));
SidePeekDrawerTitle.displayName = "SidePeekDrawerTitle";

function SidePeekDrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="side-peek-drawer-footer" className={cn("flex shrink-0 justify-end gap-2 border-t border-border-subtle bg-popover px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8", className)} {...props} />;
}

export { SidePeekDrawer, SidePeekDrawerContent, SidePeekDrawerHeader, SidePeekDrawerBody, SidePeekDrawerTitle, SidePeekDrawerFooter };
