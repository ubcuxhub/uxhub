import { FlowDialog } from "@/components/shared/FlowDialog";

/**
 * The checkout dialog. A layout, so the dialog stays open while loading.tsx
 * gives way to the page instead of remounting (and replaying its entrance).
 */
export default function InterceptedEventCheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <FlowDialog
      title="Complete event registration"
      description="Review your ticket and check out securely."
      mode="intercepted"
    >
      {children}
    </FlowDialog>
  );
}
