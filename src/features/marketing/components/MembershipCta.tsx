"use client";

import Button from "@/features/marketing/components/Button";
import { useUser } from "@/context/UserContext";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
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
 *
 * Once the club-wide term has ended there is nothing to sell, so non-members
 * get an inert button instead of a link into a flow that would refuse them.
 */
export default function MembershipCta({
  withArrow,
  shorterHeight,
  className,
}: MembershipCtaProps) {
  const { user, membershipTermEndsAt, loading } = useUser();
  const isMember = !loading && hasActiveMembership(user, membershipTermEndsAt);
  const termClosed = !loading && isMembershipTermClosed(membershipTermEndsAt);

  if (termClosed && !isMember) {
    return (
      <Button
        variant="secondary"
        withArrow={false}
        shorterHeight={shorterHeight}
        className={className}
      >
        MEMBERSHIPS CLOSED
      </Button>
    );
  }

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
