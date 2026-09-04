import { cn } from "@/lib/utils";

interface SettingsRowProps {
  title: string;
  description: string;
  /** The row's control: a switch, a button, whatever the setting needs. */
  children: React.ReactNode;
  className?: string;
}

/**
 * One labelled setting and its control.
 *
 * Deliberately unadorned — no card, no rule between rows. Spacing alone
 * separates them, so a settings tab reads as a single quiet list rather than a
 * stack of boxes.
 */
export function SettingsRow({
  title,
  description,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0",
        className,
      )}
    >
      <div className="space-y-0.5">
        <p className="text-table">{title}</p>
        <p className="text-small text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
