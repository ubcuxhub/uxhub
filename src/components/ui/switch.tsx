"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** 44 × 24 track (§3.2). The thumb grows and gains a check when on, so the
 *  state never relies on colour alone. */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] transition-colors duration-150 focus-visible:focus-ring disabled:cursor-not-allowed",
        "data-[state=unchecked]:border-muted-foreground data-[state=unchecked]:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "data-[disabled]:data-[state=unchecked]:border-disabled-border data-[disabled]:data-[state=unchecked]:bg-disabled data-[disabled]:data-[state=checked]:border-disabled-border data-[disabled]:data-[state=checked]:bg-disabled-border",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "group/thumb pointer-events-none flex items-center justify-center rounded-full transition-[translate,width,height,background-color] duration-150 ease-out",
          "data-[state=unchecked]:size-3.5 data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:bg-muted-foreground",
          "data-[state=checked]:size-[18px] data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground",
          "data-[disabled]:data-[state=unchecked]:bg-disabled-border"
        )}
      >
        <Check
          aria-hidden
          className="size-3 text-primary group-data-[state=unchecked]/thumb:hidden group-data-[disabled]/thumb:text-disabled-foreground"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
