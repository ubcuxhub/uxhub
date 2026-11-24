import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CheckInPanelTone = "success" | "warning" | "error" | "neutral";

const TONES: Record<CheckInPanelTone, string> = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  error: "bg-error text-destructive",
  neutral: "bg-background text-muted-foreground",
};

interface CheckInPanelProps {
  tone: CheckInPanelTone;
  /** A bare lucide icon; it sits in a 56px disc tinted by `tone`. */
  icon: ReactNode;
  title: ReactNode;
  /** The lines under the title: the attendee's name, the time, what to do. */
  children?: ReactNode;
  /** One or two Buttons, primary last. */
  actions?: ReactNode;
  className?: string;
}

/**
 * What the scanner shows in place of the camera: a scan result or a camera
 * problem. The title names the outcome; the icon only repeats it, so it is
 * hidden from assistive technology.
 */
export function CheckInPanel({ tone, icon, title, children, actions, className }: CheckInPanelProps) {
  const titleId = useId();
  return <section aria-labelledby={titleId} data-tone={tone} className={cn("flex w-full flex-col gap-4", className)}>
    <div className="flex min-h-66 flex-col items-center justify-center gap-3 rounded-xl bg-muted px-5 py-8 text-center">
      <span aria-hidden className={cn("flex size-14 shrink-0 items-center justify-center rounded-full [&_svg]:size-7", TONES[tone])}>{icon}</span>
      <h2 id={titleId} className="text-h3 [overflow-wrap:anywhere]">{title}</h2>
      {children}
    </div>
    {actions ? <div className="flex flex-wrap justify-end gap-2 *:flex-1 sm:*:flex-none">{actions}</div> : null}
  </section>;
}
