import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn(
        // Static, no pulse (Portal Motion handoff §2f). `bg-muted` is
        // `background-surface-subtle`: one step off the card in both themes
        // (#F1F2F5 on white, #25272C on #111111).
        "rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

