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
        // `bg-muted` is `background-surface-subtle`: one step off the card in
        // both themes (#F1F2F5 on white, #25272C on #111111).
        "animate-skeleton-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

