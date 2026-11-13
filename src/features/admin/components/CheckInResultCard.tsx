import { CircleCheck, CircleX, History, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { describeCheckInResult } from "@/features/admin/lib/check-in-result";
import type { CheckInResult } from "@/features/admin/types";
import { cn } from "@/lib/utils";

const TONES: Record<CheckInResult["status"], { className: string; icon: LucideIcon }> = {
  checked_in: { className: "bg-success text-success-foreground", icon: CircleCheck },
  already_checked_in: { className: "bg-warning text-warning-foreground", icon: History },
  rejected: { className: "bg-error text-destructive", icon: CircleX },
};

interface CheckInResultCardProps {
  result: CheckInResult;
  onNext: () => void;
}

/**
 * What a scan or a manual check-in found, large enough to read at arm's
 * length. The colour is never the only signal: the icon and the words differ
 * for each outcome too.
 */
export function CheckInResultCard({ result, onNext }: CheckInResultCardProps) {
  const { title, detail } = describeCheckInResult(result);
  const { className, icon: Icon } = TONES[result.status];

  return (
    <section
      aria-label="Check-in result"
      data-status={result.status}
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-xl p-6 text-center",
        className
      )}
    >
      <Icon aria-hidden className="size-14" strokeWidth={1.75} />
      <p role="status" className="flex flex-col gap-1">
        <span className="text-h2 [overflow-wrap:anywhere]">{title}</span>
        <span className="text-subheading">{detail}</span>
      </p>
      {/* Focused so the next scan is one tap, or Enter on a keyboard. */}
      <Button onClick={onNext} autoFocus>
        Scan next
      </Button>
    </section>
  );
}
