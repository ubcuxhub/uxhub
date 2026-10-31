import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Accessible name. Set it when the spinner stands alone: it renders a
   * `role="status"` region with the label as screen-reader text. Without it
   * the spinner is decorative (`aria-hidden`), for use inside a button or
   * beside visible text.
   */
  label?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  const icon = (
    <Loader2
      aria-hidden
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
    />
  );

  if (!label) return icon;

  return (
    <span role="status" className="inline-flex">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
