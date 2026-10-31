import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-2xl border border-border bg-background px-5 py-3 text-body text-foreground transition-colors duration-150 placeholder:text-fg-muted focus-visible:focus-ring aria-invalid:border-error disabled:cursor-not-allowed disabled:border-action-disabled-border disabled:bg-action-disabled-bg disabled:text-fg-disabled disabled:placeholder:text-fg-disabled",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
