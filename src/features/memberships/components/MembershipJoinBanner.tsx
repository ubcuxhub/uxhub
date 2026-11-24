import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Home's prompt for someone without a membership (Figma, Home midfi). It
 * replaces the empty membership card slot. Loads with the page, no entrance;
 * "Become a member" opens the purchase dialog, and once they buy, the page
 * shows their membership card in its place.
 */
export function MembershipJoinBanner({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="membership-join-banner-title"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-section p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id="membership-join-banner-title" className="text-body font-bold text-foreground">
          Join the UX Hub community
        </h2>
        <p className="text-small text-muted-foreground">
          Unlock member pricing on events and exclusive perks.
        </p>
      </div>
      <Button asChild className="self-start sm:self-auto">
        <FlowLink href="/portal/membership/join">Become a member</FlowLink>
      </Button>
    </section>
  );
}
