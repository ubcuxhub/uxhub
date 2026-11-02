"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

const OPEN_STATES = [
  "confirm",
  "confirm-typed",
  "confirm-pending",
  "confirm-error",
] as const;

type ConfirmKey = (typeof OPEN_STATES)[number];

function ConfirmDialogs({ open }: { open?: string }) {
  const [active, setActive] = useState<ConfirmKey | null>(
    OPEN_STATES.find((state) => state === open) ?? null,
  );
  const close = (next: boolean) => {
    if (!next) setActive(null);
  };
  const common = {
    onOpenChange: close,
    icon: <TriangleAlert aria-hidden />,
    title: "Delete UXathon?",
    description:
      "This removes the event and its registrations, and can’t be undone.",
    confirmLabel: "Delete event",
    cancelLabel: "Keep event",
    onConfirm: () => {},
  };

  return (
    <>
      <Specimen label="Plain (?open=confirm)">
        <Button variant="outline" onClick={() => setActive("confirm")}>
          Open plain confirm
        </Button>
        <ConfirmDialog {...common} open={active === "confirm"} />
      </Specimen>
      <Specimen label="Typed challenge (?open=confirm-typed)">
        <Button variant="outline" onClick={() => setActive("confirm-typed")}>
          Open typed confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-typed"}
          confirmation={{
            label: "Event name",
            hint: (
              <>
                Type <b>uxathon-2026</b> to confirm.
              </>
            ),
            placeholder: "Event name",
            matches: (typed) => typed === "uxathon-2026",
            mismatchMessage: "That doesn’t match the event name.",
          }}
        />
      </Specimen>
      <Specimen label="Pending (?open=confirm-pending)">
        <Button variant="outline" onClick={() => setActive("confirm-pending")}>
          Open pending confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-pending"}
          pending
          pendingLabel="Deleting…"
        />
      </Specimen>
      <Specimen label="Server error (?open=confirm-error)">
        <Button variant="outline" onClick={() => setActive("confirm-error")}>
          Open error confirm
        </Button>
        <ConfirmDialog
          {...common}
          open={active === "confirm-error"}
          error="Couldn’t delete the event. Try again."
        />
      </Specimen>
    </>
  );
}

function ConfirmDialogDemo({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="ConfirmDialog"
        spec="§3.7, §2.9"
        description="Plain, typed challenge, pending and error. In the typed one, type a wrong value for the mismatch state and uxathon-2026 for the match. Portaled, so check each in theme=light and theme=dark, and on the mobile preset for the fullscreen layout."
        min="14rem"
      >
        <ConfirmDialogs open={open} />
      </SpecimenGroup>
    </div>
  );
}

export default ConfirmDialogDemo;
