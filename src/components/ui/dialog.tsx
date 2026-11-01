"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

/**
 * Radix moves focus to the first focusable element when a dialog opens. In
 * our content that is the close `IconButton`, whose tooltip opens on focus and
 * which Chrome treats as `:focus-visible`, so the tooltip and a focus ring
 * appear before anyone has touched it. Focus the content container instead:
 * it is focusable (`tabIndex=-1`), so assistive tech still announces the
 * dialog by its title, and Tab moves on to the first control.
 *
 * Composes with callers: their own `onOpenAutoFocus` runs first and
 * `preventDefault()` skips this. Focus already inside the content is kept, and
 * an element marked `data-autofocus` takes focus instead of the container.
 * Shared with `ui/sheet`.
 */
function focusContentOnOpen(
  event: Event,
  onOpenAutoFocus?: (event: Event) => void,
) {
  onOpenAutoFocus?.(event);
  if (event.defaultPrevented) return;
  const content = event.currentTarget as HTMLElement | null;
  if (!content) return;
  event.preventDefault();
  const active = document.activeElement;
  if (active && active !== content && content.contains(active)) return;
  const marked = content.querySelector<HTMLElement>("[data-autofocus]");
  (marked ?? content).focus({ preventScroll: true });
}

/**
 * A field marked `data-escape-clears` (SearchField, SearchableDropdown) uses
 * Esc to clear its text first. While such a field holds text, Esc must not
 * also close the dialog or sheet around it. The marker may sit on the input or
 * on a wrapper; the focused element can be the input or a control beside it.
 * Shared with `ui/sheet`.
 */
function escapeClearsField(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const host = target.closest("[data-escape-clears]");
  if (!host) return false;
  const field =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target
      : host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        );
  return Boolean(field && field.value !== "");
}

/**
 * Composes with callers: their `onEscapeKeyDown` runs first and
 * `preventDefault()` keeps the overlay open. Shared with `ui/sheet`.
 */
function guardEscape(
  event: KeyboardEvent,
  onEscapeKeyDown?: (event: KeyboardEvent) => void,
  blocked = false,
) {
  onEscapeKeyDown?.(event);
  if (event.defaultPrevented) return;
  if (blocked || escapeClearsField(event)) event.preventDefault();
}

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-scrim duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Blocks every way of closing, not only the X: Esc and clicks outside too.
   * Use it while a save is in flight.
   */
  closeDisabled?: boolean;
  closeLabel?: string;
  mobileFullscreen?: boolean;
  size?: "default" | "large";
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      closeDisabled = false,
      closeLabel = "Close",
      mobileFullscreen = false,
      size = "default",
      onOpenAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-size={size}
        className={cn(
          // Centred, never closer than 40px to the top or bottom, and scrolls
          // inside. The large and fullscreen sizes manage their own scrolling.
          "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-80px)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border bg-popover p-6 text-popover-foreground shadow-overlay duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
          size === "large" &&
            "safe-area-bleed-y h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 sm:h-[80vh] sm:max-h-[min(760px,calc(100dvh-80px))] sm:w-[calc(100vw-1rem)] sm:max-w-[1000px] sm:rounded-2xl sm:border",
          mobileFullscreen &&
            "safe-area-bleed-y h-dvh max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[calc(100dvh-80px)] sm:w-full sm:max-w-lg sm:gap-4 sm:overflow-y-auto sm:rounded-2xl sm:border sm:p-6",
          // The container takes focus on open (see `focusContentOnOpen`). It is
          // not a control, so it gets no ring.
          "outline-none",
          className,
        )}
        onOpenAutoFocus={(event) => focusContentOnOpen(event, onOpenAutoFocus)}
        onEscapeKeyDown={(event) =>
          guardEscape(event, onEscapeKeyDown, closeDisabled)
        }
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          if (closeDisabled) event.preventDefault();
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <IconButton
            variant="ghost"
            label={closeLabel}
            disabled={closeDisabled}
            className={cn(
              "absolute z-10 text-muted-foreground hover:text-foreground",
              size === "large" || mobileFullscreen
                ? "right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] sm:right-4 sm:top-4"
                : "right-4 top-[2.375rem] -translate-y-1/2",
            )}
          >
            <X />
          </IconButton>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 pr-8 text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-h3 text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-small text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  focusContentOnOpen,
  guardEscape,
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
