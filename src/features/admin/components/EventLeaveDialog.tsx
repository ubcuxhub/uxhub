"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";

export function EventLeaveDialog({ eventName, navigation, draft, pending, error, save }: {
  eventName: string;
  navigation: ReturnType<typeof useUnsavedChangesGuard>; draft: boolean; pending: boolean; error: string | null; save: () => Promise<boolean>;
}) {
  return <Dialog open={navigation.open} onOpenChange={open => { if (!open && !pending) navigation.cancel(); }}><DialogContent showCloseButton={false} className="max-w-[482px] gap-4 p-5" closeDisabled={pending} onCloseAutoFocus={event => { if (navigation.opener.current?.isConnected) { event.preventDefault(); navigation.opener.current.focus(); } }}>
    <DialogHeader className="space-y-0 pr-0"><DialogTitle>{draft ? "Leave without saving?" : "Leave without updating?"}</DialogTitle><DialogDescription>{draft ? `Your changes to ${eventName} aren’t saved. Save a draft to keep them, or leave and lose them.` : "Your changes aren’t live yet and will be lost. Members keep seeing the published version."}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="text-small text-destructive">{error}</p>}
    <DialogFooter className="flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={navigation.cancel}>Keep editing</Button><Button type="button" variant={draft ? "outline" : "destructive"} disabled={pending} onClick={navigation.leave}>{draft ? "Leave without saving" : "Discard and leave"}</Button>{draft && <Button type="button" loading={pending} onClick={async () => { if (await save()) navigation.leave(); }}>Save draft and leave</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
