"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  /** Where focus goes on close. Falls back to whatever had focus when the panel opened. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

interface SidePeekDrawerContextValue {
  requestClose: () => void;
  /** Leaves for `href`, asking first when there are unsaved changes. */
  requestNavigate: (href: string) => void;
  dirty: boolean;
  /** Below `sm` the panel covers the screen, so it is modal there. */
  phone: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** The element focused when the panel opened, for when `returnFocusRef` is missing or gone. */
  openerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLElement | null>;
}

const SidePeekDrawerContext = React.createContext<SidePeekDrawerContextValue | null>(null);

function useSidePeekDrawer() {
  const context = React.useContext(SidePeekDrawerContext);
  if (!context) throw new Error("SidePeekDrawer parts must be inside SidePeekDrawer");
  return context;
}

/** Matches the `sm:` breakpoint the panel's width switches at. */
const PHONE_QUERY = "(max-width: 639px)";

function subscribePhone(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getPhoneSnapshot() {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;
}

function usePhone() {
  return React.useSyncExternalStore(subscribePhone, getPhoneSnapshot, () => false);
}

/**
 * A panel beside its list: the page stays scrollable and a row click swaps the
 * record. At phone width it fills the screen, so it becomes modal there (focus
 * trapped, the page behind hidden from assistive tech).
 */
function SidePeekDrawer({
  open,
  onOpenChange,
  dirty = false,
  returnFocusRef,
  children,
}: SidePeekDrawerProps) {
  const router = useRouter();
  const phone = usePhone();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  // Remember what had focus so "Keep editing" can put it back.
  const rememberFocus = () => {
    const active = document.activeElement;
    restoreRef.current =
      active instanceof HTMLElement && contentRef.current?.contains(active) ? active : null;
  };

  const requestClose = () => {
    if (dirty) {
      rememberFocus();
      setPendingHref(null);
      setConfirmOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const requestNavigate = (href: string) => {
    rememberFocus();
    setPendingHref(href);
    setConfirmOpen(true);
  };

  const keepEditing = () => {
    setConfirmOpen(false);
    setPendingHref(null);
    // The confirmation's own focus return has nowhere to go (it has no trigger),
    // so put focus back in the panel once it has let go.
    const restore = restoreRef.current?.isConnected
      ? restoreRef.current
      : contentRef.current?.querySelector<HTMLElement>('[data-slot="side-peek-drawer-title"]');
    requestAnimationFrame(() => restore?.focus({ preventScroll: true }));
  };

  return (
    <SidePeekDrawerContext.Provider
      value={{ requestClose, requestNavigate, dirty, phone, returnFocusRef, openerRef, contentRef }}
    >
      <DialogPrimitive.Root
        modal={phone}
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
        onOpenChange={(next) => {
          if (next) setConfirmOpen(true);
          else keepEditing();
        }}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmOpen(false);
          onOpenChange(false);
          if (pendingHref) router.push(pendingHref);
          setPendingHref(null);
        }}
      />
    </SidePeekDrawerContext.Provider>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Esc closes the panel only when it is meant for the panel: from inside it, or
 * with nothing focused. Esc typed into the page (a search box, say) or into a
 * field that clears on Esc (`data-escape-clears` with text in it) is not ours.
 * Radix already skips the panel when another layer (a popover, a dialog) is on top.
 */
function isEscapeForOthers(event: KeyboardEvent, content: HTMLElement | null) {
  const target = event.target instanceof Element ? event.target : null;
  const clears = target?.closest("[data-escape-clears]");
  if (clears) {
    const field =
      clears instanceof HTMLInputElement || clears instanceof HTMLTextAreaElement
        ? clears
        : clears.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    if (field?.value) return true;
  }
  if (!target || target === document.body || target === document.documentElement) return false;
  return !content?.contains(target);
}

const SidePeekDrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, onOpenAutoFocus, onCloseAutoFocus, onKeyDownCapture, onEscapeKeyDown, onInteractOutside, onPointerDownOutside, children, ...props }, ref) => {
  const { returnFocusRef, openerRef, contentRef, phone } = useSidePeekDrawer();
  const setRefs = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  const returnTarget = () => {
    const explicit = returnFocusRef?.current;
    if (explicit?.isConnected) return explicit;
    const opener = openerRef.current;
    return opener?.isConnected ? opener : null;
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        ref={setRefs}
        data-slot="side-peek-drawer-content"
        className={cn(
          "safe-area-bleed-y fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col overflow-hidden border-l border-border-subtle bg-popover text-popover-foreground shadow-overlay duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:fade-in-0 sm:w-[560px]",
          className,
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          const content = event.currentTarget as HTMLElement;
          const active = document.activeElement;
          openerRef.current =
            active instanceof HTMLElement && active !== document.body && !content.contains(active)
              ? active
              : null;
          content.querySelector<HTMLElement>('[data-slot="side-peek-drawer-title"]')?.focus();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = returnTarget();
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event);
          if (event.defaultPrevented) return;
          // Preventing the keystroke is how Radix is told not to dismiss. Fields
          // that clear on Esc (SearchField, SearchableDropdown) ignore a keydown
          // that was prevented before their own handler ran, so they still clear.
          if (isEscapeForOthers(event, contentRef.current)) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event);
          event.preventDefault();
        }}
        // Nonmodal: Tab leaves the panel at either edge instead of wrapping, so
        // keyboard users can get back to the list. Radix's focus scope would
        // wrap, so stop the keystroke before it gets there. Shift+Tab from the
        // first control goes straight back to the row that opened the panel
        // (the panel sits at the end of the DOM, so the browser would land on
        // the page's last control). Modal (phone) keeps Radix's trap.
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event);
          if (phone || event.defaultPrevented || event.key !== "Tab") return;
          if (event.ctrlKey || event.altKey || event.metaKey) return;
          const content = event.currentTarget;
          if (!(event.target instanceof Node) || !content.contains(event.target)) return;
          const tabbables = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE))
            .filter((item) => item.getAttribute("aria-hidden") !== "true" && item.tabIndex >= 0);
          const active = document.activeElement;
          const atFirst = tabbables.length === 0 || active === tabbables[0] || active === content;
          const atLast = tabbables.length === 0 || active === tabbables[tabbables.length - 1];
          if (event.shiftKey && atFirst) {
            const target = returnTarget();
            if (target) {
              event.preventDefault();
              target.focus();
            }
            event.stopPropagation();
          } else if (!event.shiftKey && atLast) {
            event.stopPropagation();
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
  const { requestClose, requestNavigate, dirty } = useSidePeekDrawer();
  return (
    <div
      data-slot="side-peek-drawer-header"
      className={cn("flex shrink-0 items-center justify-between border-b border-border-subtle px-6 pb-4 pt-10", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <IconButton variant="ghost" label="Close panel (Esc)" onClick={requestClose} className="rounded-lg text-muted-foreground">
          <ChevronsRight className="size-[18px]" />
        </IconButton>
        {fullPageHref ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={fullPageHref}
                aria-label="Open as full page"
                onClick={(event) => {
                  // A new-tab click keeps this tab's edits, so only plain clicks ask first.
                  if (!dirty || event.defaultPrevented || event.button !== 0) return;
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  requestNavigate(fullPageHref);
                }}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-lg text-muted-foreground")}
              >
                <Maximize2 className="size-[18px]" aria-hidden />
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
