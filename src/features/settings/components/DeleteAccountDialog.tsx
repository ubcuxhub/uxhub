"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  const handleDelete = async (confirmation: string) => {
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
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Delete account"
      description="This permanently deletes your sign-in. You will not be able to log back in, and this cannot be undone. Any active membership is forfeited without a refund."
      confirmation={{
        label: "Confirm your email address",
        type: "email",
        // The server action re-checks this; the client copy only gates the
        // button, so both sides share `matchesConfirmationEmail`.
        matches: (typed) => matchesConfirmationEmail(typed, email),
        hint: (
          <>
            Type <span className="font-medium text-foreground">{email}</span> to
            confirm.
          </>
        ),
      }}
      confirmLabel="Delete account"
      pendingLabel="Deleting..."
      error={error}
      pending={deleting}
      onConfirm={handleDelete}
    />
  );
}
