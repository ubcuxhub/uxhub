import { MembershipWizard } from "@/features/memberships";

export default function MembershipJoinPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-md">
        <MembershipWizard />
      </div>
    </div>
  );
}
