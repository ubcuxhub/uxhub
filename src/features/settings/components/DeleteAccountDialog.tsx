"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
import { createClient } from "@/lib/supabase/client";
import { deleteAccountAction } from "../actions";
import { matchesConfirmationEmail } from "../lib/account-deletion";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Email of the signed-in account, which the user must type to confirm. */
  email: string;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reopening should start from a blank slate rather than a primed button.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmation("");
      setError(null);
    }
    onOpenChange(next);
  };

  const confirmed = matchesConfirmationEmail(confirmation, email);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    const result = await deleteAccountAction(confirmation);

    if (!result.ok) {
      setError(result.error);
      setDeleting(false);
      return;
    }

    // The auth user is gone, but this browser still holds its session cookie.
    // Without clearing it the next guarded request would look authenticated and
    // mint a fresh, empty profile row.
    await createClient().auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent closeDisabled={deleting}>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This permanently deletes your sign-in. You will not be able to log
            back in, and this cannot be undone. Any active membership is
            forfeited without a refund.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-account-confirmation">
            Confirm your email address
          </Label>
          <Input
            id="delete-account-confirmation"
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={deleting}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-describedby="delete-account-hint"
          />
          <p id="delete-account-hint" className="text-small text-muted-foreground">
            Type <span className="font-medium text-foreground">{email}</span> to
            confirm.
          </p>
          {error && <p className="text-small text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={deleting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting..." : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
