import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One read-only label/value pair in a record. */
function DetailList({ className, ...props }: ComponentProps<"dl">) {
  return <dl className={cn("w-full", className)} {...props} />;
}

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={cn("grid grid-cols-1 gap-1 border-b border-border-subtle py-3 text-body sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">
        {empty ? <><span aria-hidden>—</span><span className="sr-only">None</span></> : children}
      </dd>
    </div>
  );
}

export { DetailList, DetailRow };
