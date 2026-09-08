"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { createClient } from "@/lib/supabase/client";
import { deleteAccountAction } from "../actions";
import { matchesConfirmationEmail } from "../lib/account-deletion";

type BrowserSupabaseClient = ReturnType<typeof createClient>;
type ReconciliationResult = "active" | "deleted" | "unknown";

const UNKNOWN_OUTCOME_MESSAGE =
  "The deletion outcome is unknown because the request or account check did not complete. It was not retried automatically. Check your connection before trying again.";

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

    try {
      const supabase = createClient();
      let result;

      try {
        result = await withDeadline(() => deleteAccountAction(confirmation), {
          operation: "Account deletion",
        });
      } catch (deletionError) {
        const reconciliation = await reconcileAccountStatus(supabase);

        if (reconciliation === "deleted") {
          await finishDeletedAccount(supabase, false, () => {
            router.replace("/auth/login");
            router.refresh();
          });
          return;
        }

        if (reconciliation === "active") {
          setError(
            isAsyncTimeoutError(deletionError)
              ? "The deletion request timed out, so its final outcome is unknown. Your account is currently still active, and the request was not retried automatically. You can wait and try again."
              : "Your account is still active. The deletion request did not complete normally and was not retried automatically. You can try again.",
          );
          return;
        }

        setError(UNKNOWN_OUTCOME_MESSAGE);
        return;
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await finishDeletedAccount(supabase, true, () => {
        router.replace("/auth/login");
        router.refresh();
      });
    } catch (unexpectedError) {
      logCleanupFailure("flow", unexpectedError);
      setError(
        "We could not finish cleaning up this browser session. Go to the login page before continuing.",
      );
    } finally {
      setDeleting(false);
    }
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

async function reconcileAccountStatus(
  supabase: BrowserSupabaseClient,
): Promise<ReconciliationResult> {
  try {
    const {
      data: { user },
      error,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Account status check",
    });

    if (user) return "active";
    if (!error || error.status === 401 || error.status === 403) return "deleted";

    return "unknown";
  } catch {
    return "unknown";
  }
}

async function finishDeletedAccount(
  supabase: BrowserSupabaseClient,
  revokeRemoteSession: boolean,
  navigateToLogin: () => void,
) {
  if (revokeRemoteSession) {
    try {
      const { error } = await withDeadline(() => supabase.auth.signOut(), {
        operation: "Remote sign out",
      });
      if (error) logCleanupFailure("remote sign-out", error);
    } catch (error) {
      logCleanupFailure("remote sign-out", error);
    }
  }

  // A failed remote revocation must not leave the deleted account's cookie in
  // this browser. Supabase's local scope removes local auth state without
  // depending on the remote auth service.
  try {
    const { error } = await withDeadline(
      () => supabase.auth.signOut({ scope: "local" }),
      {
        operation: "Local sign out",
      },
    );
    if (error) logCleanupFailure("local sign-out", error);
  } catch (error) {
    logCleanupFailure("local sign-out", error);
  } finally {
    navigateToLogin();
  }
}

function logCleanupFailure(stage: string, error: unknown) {
  console.warn(`Account deletion ${stage} did not complete.`, {
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
}
