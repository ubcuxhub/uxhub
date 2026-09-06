"use client";

import { FlowDialog } from "@/components/shared/FlowDialog";

interface MembershipFlowDialogProps {
  children: React.ReactNode;
  mode: "canonical" | "intercepted";
}

export function MembershipFlowDialog({
  children,
  mode,
}: MembershipFlowDialogProps) {
  return (
    <FlowDialog
      title="Become a UX Hub member"
      description="Choose the membership that fits you and check out securely."
      mode={mode}
      allowCloseWhileBusy
    >
      {children}
    </FlowDialog>
  );
}
