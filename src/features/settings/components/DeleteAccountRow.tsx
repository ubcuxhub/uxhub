"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SettingsRow } from "./SettingsRow";

/**
 * The "Delete account" setting and the confirmation flow behind it. Kept apart
 * from the rest of the General tab so the destructive path is one file you can
 * read end to end.
 */
export function DeleteAccountRow() {
  const { user } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Confirmation is typing the account's email, so there is nothing to confirm
  // against until the profile has loaded.
  const email = user?.email ?? "";

  return (
    <>
      <SettingsRow
        title="Delete account"
        description="Permanently delete your UX Hub account. This cannot be undone."
      >
        <Button
          variant="destructive"
          disabled={!email}
          onClick={() => setDialogOpen(true)}
        >
          <Trash2 />
          Delete account
        </Button>
      </SettingsRow>

      {email && (
        <DeleteAccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          email={email}
        />
      )}
    </>
  );
}
