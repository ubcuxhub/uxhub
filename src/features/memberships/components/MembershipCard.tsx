import Image from "next/image";

import { formatEventDate } from "@/lib/date";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { MembershipTypeRow } from "@/lib/supabase/models";
import { cn } from "@/lib/utils";
import { MembershipCardSurface } from "./MembershipCardSurface";

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
  className,
}: {
  cardholder: string;
  /** Effective expiry, already capped by the club-wide term end. */
  expiresAt: string | null;
  membershipType: Pick<MembershipTypeRow, "description" | "name">;
  className?: string;
}) {
  const expiryDate = formatEventDate(expiresAt);

  // Figma 3262:3182: the label and logo, the cardholder and tier, the
  // benefit, and the door note with the expiry along the bottom.
  return (
    <MembershipCardSurface className={cn("max-w-[492px]", className)}>
      <div className="flex flex-1 flex-col justify-between gap-6 p-6">
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <p className="text-badge font-semibold tracking-[0.08em] text-white/70 uppercase">
              Membership
            </p>
            <Image src="/icons/icon-light.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
          </div>

          <div className="flex max-w-80 flex-col gap-5">
            <div className="flex flex-col items-start gap-2.5">
              <p className="text-h2 wrap-anywhere">{cardholder}</p>
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-badge font-semibold">
                {formatMembershipTypeName(membershipType.name)} Member
              </span>
            </div>
            <p className="text-small leading-[1.4]">{membershipType.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-badge font-normal leading-[1.4]">
          <p className="max-w-50">Show this card at the door. You still need to register for each event.</p>
          {expiryDate && <p className="shrink-0">Valid until {expiryDate}</p>}
        </div>
      </div>
    </MembershipCardSurface>
  );
}
