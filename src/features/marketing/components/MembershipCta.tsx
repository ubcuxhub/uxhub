"use client";

import Button from "@/features/marketing/components/Button";
import { useUser } from "@/context/UserContext";
import { hasActiveMembership } from "@/lib/membership";

interface MembershipCtaProps {
  withArrow?: boolean;
  shorterHeight?: boolean;
  className?: string;
}

/**
 * Marketing call to action that points active members at their portal and
 * everyone else at the join flow. While the session is still loading it shows
 * the signed-out copy, which is what most marketing visitors end up seeing.
 */
export default function MembershipCta({
  withArrow,
  shorterHeight,
  className,
}: MembershipCtaProps) {
  const { user, loading } = useUser();
  const isMember = !loading && hasActiveMembership(user);

  return (
    <Button
      variant="primary"
      withArrow={withArrow}
      shorterHeight={shorterHeight}
      className={className}
      href={isMember ? "/portal" : "/portal/membership/join"}
    >
      {isMember ? "VIEW MY MEMBERSHIP" : "BECOME A MEMBER"}
    </Button>
  );
}
