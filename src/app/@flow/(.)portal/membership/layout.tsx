import { MembershipFlowDialog } from "@/features/memberships/components/MembershipFlowDialog";

export default function InterceptedMembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MembershipFlowDialog mode="intercepted">
      {children}
    </MembershipFlowDialog>
  );
}
