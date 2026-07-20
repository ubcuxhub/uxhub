import { MembershipFlowDialog } from "@/features/memberships/components/MembershipFlowDialog";

export default function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MembershipFlowDialog mode="canonical">{children}</MembershipFlowDialog>
  );
}
