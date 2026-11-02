"use client";

import { useRef, useState } from "react";
import {
  CalendarPlus,
  Copy,
  Ellipsis,
  Link2,
  Mail,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * The documented pattern: an icon-button trigger, destructive item last after a
 * separator, and its `onSelect` opening a ConfirmDialog that sits outside the
 * menu. The menu skips its own focus return while the dialog is open, and the
 * dialog hands focus back to the trigger when it closes.
 */
export function EventActionsMenu({
  defaultOpen = false,
  defaultConfirmOpen = false,
}: {
  defaultOpen?: boolean;
  defaultConfirmOpen?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(defaultConfirmOpen);
  const [pinned, setPinned] = useState(true);

  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={triggerRef} label="Actions for UXathon">
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => {
            if (confirmOpen) event.preventDefault();
          }}
        >
          <DropdownMenuLabel>UXathon 2026</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Pencil aria-hidden />
              Edit event
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy aria-hidden />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CalendarPlus aria-hidden />
              Add to calendar
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
            Pin to dashboard
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 aria-hidden />
              Share
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>
                <Link2 aria-hidden />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail aria-hidden />
                Email
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            Delete event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          // The dialog has no trigger of its own, so give focus back by hand
          // once Radix has finished unmounting it.
          if (!next) setTimeout(() => triggerRef.current?.focus(), 0);
        }}
        title="Delete UXathon?"
        description="Registrations and tickets for this event are removed. This can't be undone."
        cancelLabel="Keep event"
        confirmLabel="Delete event"
        onConfirm={() => setConfirmOpen(false)}
      />
    </>
  );
}
