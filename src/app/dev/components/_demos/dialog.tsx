"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

function DialogDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Dialog"
        spec="§3.7"
        description="Default, large (settings and checkout flows), tall content and mobileFullscreen (ConfirmDialog). Open with the buttons, or force one with ?open=. Check each in theme=light and theme=dark, and on the mobile preset."
      >
        <Specimen label="Dialog · explicit actions without X (?open=dialog-actions)">
          <Dialog defaultOpen={open === "dialog-actions"}>
            <DialogTrigger asChild><Button variant="outline">Open action-only dialog</Button></DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader><DialogTitle>Leave without saving?</DialogTitle><DialogDescription>Save a draft to keep your changes, or leave and lose them. Esc and outside clicks still dismiss this dialog.</DialogDescription></DialogHeader>
              <DialogFooter><DialogClose asChild><Button variant="outline">Keep editing</Button></DialogClose><DialogClose asChild><Button>Save draft and leave</Button></DialogClose></DialogFooter>
            </DialogContent>
          </Dialog>
        </Specimen>

        <Specimen label="Dialog · default (?open=dialog)">
          <Dialog defaultOpen={open === "dialog"}>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit event details</DialogTitle>
                <DialogDescription>
                  Changes are visible to students as soon as you save.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="dialog-name">Event name</Label>
                <Input id="dialog-name" defaultValue="UXathon 2026" />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Specimen>

        <Specimen label='Dialog · size="large" (?open=dialog-large)'>
          <Dialog defaultOpen={open === "dialog-large"}>
            <DialogTrigger asChild>
              <Button variant="outline">Open large dialog</Button>
            </DialogTrigger>
            <DialogContent
              size="large"
              className="flex flex-col gap-0 overflow-hidden p-0"
            >
              <DialogHeader className="shrink-0 border-b border-border-subtle p-5 pt-16 sm:p-6 sm:pt-6">
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Fills the viewport on phones, 1000px wide on desktop. The
                  body scrolls once, inside the dialog.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-5 text-small text-muted-foreground sm:p-6">
                {Array.from({ length: 24 }, (_, i) => (
                  <p key={i} className="py-1">
                    Row {i + 1}. Long content scrolls inside a large dialog.
                  </p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </Specimen>

        <Specimen label="Dialog · tall content (?open=dialog-tall)">
          <Dialog defaultOpen={open === "dialog-tall"}>
            <DialogTrigger asChild>
              <Button variant="outline">Open tall dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Terms of registration</DialogTitle>
                <DialogDescription>
                  Stays 40px clear of the top and scrolls inside.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 text-small text-muted-foreground">
                {Array.from({ length: 30 }, (_, i) => (
                  <p key={i}>
                    Clause {i + 1}. Attendees agree to follow the club code of
                    conduct at every event.
                  </p>
                ))}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Decline</Button>
                </DialogClose>
                <Button>Accept</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Specimen>

        <Specimen label="Dialog · mobileFullscreen (?open=dialog-mobile)">
          <Dialog defaultOpen={open === "dialog-mobile"}>
            <DialogTrigger asChild>
              <Button variant="outline">Open fullscreen on mobile</Button>
            </DialogTrigger>
            <DialogContent mobileFullscreen>
              <DialogHeader className="border-b border-border-subtle pb-5 pl-5 pr-20 pt-16 text-left sm:border-0 sm:p-0">
                <DialogTitle>Fullscreen on mobile</DialogTitle>
                <DialogDescription>
                  Below 640px this fills the screen.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-auto border-t border-border-subtle p-5 sm:mt-0 sm:border-0 sm:p-0 [&>button]:w-full sm:[&>button]:w-auto">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Dialog"
        description="A destructive confirmation as the admin pages ask for it (?open=dialog-delete)."
      >
        <div>
          <Dialog defaultOpen={open === "dialog-delete"}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete UXathon?</DialogTitle>
                <DialogDescription>
                  This removes the event, its 48 registrations and all
                  applications. Attendees are not notified, and this can’t be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep event</Button>
                </DialogClose>
                <Button variant="destructive">Delete event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Composition>
    </div>
  );
}

export default DialogDemo;
