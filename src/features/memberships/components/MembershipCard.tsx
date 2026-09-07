import Image from "next/image";
import { Sparkles } from "lucide-react";

import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/date";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { MembershipTypeRow } from "@/types/models";

/**
 * The member-facing membership card on the portal home page.
 *
 * It is the student's proof of membership at the door, so the tier, the
 * cardholder, and the expiry all have to be readable at a glance. The benefit
 * line is the tier's own `description`, the same sentence they read when they
 * picked the tier — one string, so what you bought and what your card says
 * cannot drift apart.
 */
export function MembershipCard({
  cardholder,
  expiresAt,
  membershipType,
}: {
  cardholder: string;
  /** Effective expiry, already capped by the club-wide term end. */
  expiresAt: string | null;
  membershipType: Pick<MembershipTypeRow, "description" | "name">;
}) {
  const expiryDate = formatEventDate(expiresAt);

  return (
    <section className="max-w-[490px] overflow-hidden rounded-2xl bg-[image:var(--gradient-ux-hub)] text-white shadow-sm">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-badge uppercase tracking-widest text-white/70">
              Membership
            </p>
            <p className="mt-2 text-h2">{cardholder}</p>
          </div>
          <Image
            src="/icons/icon-light.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 opacity-90"
          />
        </div>

        <span className="mt-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-badge ring-1 ring-inset ring-white/25">
          {formatMembershipTypeName(membershipType.name)} member
        </span>

        <p className="mt-6 border-t border-white/20 pt-6 text-small text-white/90">
          {membershipType.description}
        </p>
      </div>

      <div className="border-t border-white/20 bg-black/10 px-6 py-4 text-small text-white/80">
        <p>Show this card at the door. You still need to register for each event.</p>
        {expiryDate && <p className="mt-1">Valid until {expiryDate}</p>}
      </div>
    </section>
  );
}

/** What the same slot shows before someone has bought a membership. */
export function MembershipCardEmptyState() {
  return (
    <section className="max-w-xl rounded-2xl border border-dashed p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <h2 className="text-subheading">You don&rsquo;t have a membership yet</h2>
          <p className="mt-1 text-small text-muted-foreground">
            Join UX Hub for member pricing on every event, plus perks reserved
            for members.
          </p>
        </div>
      </div>
      <Button asChild className="mt-5">
        <FlowLink href="/portal/membership/join">Become a member</FlowLink>
      </Button>
    </section>
  );
}
