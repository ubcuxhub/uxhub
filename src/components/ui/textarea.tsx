import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-2xl border border-border bg-background px-5 py-3 text-body text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
