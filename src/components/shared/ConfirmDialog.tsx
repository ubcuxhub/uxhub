"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Optional "type this to prove you mean it" gate.
 *
 * `matches` is a predicate rather than an expected string so each caller keeps
 * its own rule about what counts — deleting an account forgives case and
 * whitespace, deleting an event does not.
 */
export interface ConfirmationChallenge {
  label: string;
  /** Rendered under the input, e.g. "Type <b>my-event</b> to confirm." */
  hint?: React.ReactNode;
  placeholder?: string;
  type?: "text" | "email";
  matches: (typed: string) => boolean;
  /** Shown once something has been typed and it still does not match. */
  mismatchMessage?: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Rendered beside the title, e.g. a lucide warning icon. */
  icon?: React.ReactNode;
  /** Omit for a plain confirm with no typed challenge. */
  confirmation?: ConfirmationChallenge;
  confirmLabel?: string;
  /** Replaces the confirm label while `pending`. */
  pendingLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "destructive" | "default";
  /** Server-side failure to surface above the buttons. */
  error?: string | null;
  pending?: boolean;
  /** Receives the confirmation text, so callers need not mirror it in state. */
  onConfirm: (typed: string) => void;
}

/**
 * Shared confirmation dialog for actions that are hard or impossible to undo.
 *
 * Built on the `ui/dialog` primitive so every one of these gets a focus trap,
 * Escape-to-close, and the right ARIA roles, and so the destructive actions in
 * the app read the same way instead of each inventing its own layout.
 *
 * The dialog never closes itself on confirm: some callers navigate away, others
 * stay open to show a server error. Close it from the caller once the action
 * has actually succeeded.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  pending = false,
  ...body
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent closeDisabled={pending} mobileFullscreen>
        {/* Radix unmounts this while the dialog is closed, so the confirmation
            input below resets on its own — reopening never finds a primed
            button left over from last time. */}
        <ConfirmDialogBody
          {...body}
          pending={pending}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type ConfirmDialogBodyProps = Omit<
  ConfirmDialogProps,
  "open" | "onOpenChange"
> & { onCancel: () => void };

function ConfirmDialogBody({
  title,
  description,
  icon,
  confirmation,
  confirmLabel = "Confirm",
  pendingLabel,
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  error,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogBodyProps) {
  const inputId = useId();
  const hintId = useId();
  const [typed, setTyped] = useState("");

  const satisfied = confirmation ? confirmation.matches(typed) : true;
  const mismatch = Boolean(confirmation && typed && !satisfied);
  const hasBody = Boolean(confirmation || error);

  return (
    <div className="flex h-full min-h-0 flex-col gap-0 sm:h-auto sm:gap-4">
      <DialogHeader className="shrink-0 border-b pb-5 pl-5 pr-20 pt-16 text-left sm:border-0 sm:p-0">
        <DialogTitle
          className={cn(
            icon &&
              "flex items-center gap-3 text-destructive [&_svg]:size-6 sm:gap-2 sm:[&_svg]:size-4",
          )}
        >
          {icon}
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {hasBody ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:overflow-visible sm:p-0">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {confirmation ? (
              <div className="space-y-2">
                <Label htmlFor={inputId}>{confirmation.label}</Label>
                <Input
                  id={inputId}
                  type={confirmation.type ?? "text"}
                  placeholder={confirmation.placeholder}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={pending}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  aria-describedby={confirmation.hint ? hintId : undefined}
                  aria-invalid={mismatch || undefined}
                  className={cn(mismatch && "border-destructive")}
                />
                {confirmation.hint ? (
                  <p id={hintId} className="text-small text-muted-foreground">
                    {confirmation.hint}
                  </p>
                ) : null}
                {mismatch && confirmation.mismatchMessage ? (
                  <p className="text-small text-destructive">
                    {confirmation.mismatchMessage}
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="text-small text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex-1 sm:hidden" />
      )}

      <DialogFooter className="mt-auto shrink-0 gap-3 border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [&>button]:w-full sm:mt-0 sm:gap-0 sm:border-0 sm:p-0 sm:[&>button]:w-auto">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          disabled={!satisfied || pending}
          onClick={() => onConfirm(typed)}
        >
          {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
