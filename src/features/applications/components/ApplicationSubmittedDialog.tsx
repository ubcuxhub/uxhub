"use client";

import Link from "next/link";

import { Hubbo } from "@/components/shared/Hubbo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApplicationSubmittedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  eventHref: string;
}

/** Confirms a submitted application, with Hubbo and the way back to the event. */
export function ApplicationSubmittedDialog({
  open,
  onOpenChange,
  eventName,
  eventHref,
}: ApplicationSubmittedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="justify-items-center gap-0 px-6 pt-12 pb-6 text-center sm:max-w-2xl sm:px-10 sm:pt-16">
        <Hubbo emotion="proud" size="card" />
        <DialogTitle className="mt-6">Application submitted</DialogTitle>
        <DialogDescription className="mt-2 text-body">
          We&apos;ll email you once a decision is made.
        </DialogDescription>
        <Button
          asChild
          variant="secondary"
          className="mt-8 sm:mt-12 sm:justify-self-end"
        >
          <Link href={eventHref}>Back to {eventName}</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
