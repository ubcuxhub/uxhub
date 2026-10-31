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
        "data-[state=unchecked]:border-fg-secondary data-[state=unchecked]:bg-surface-subtle data-[state=checked]:border-action data-[state=checked]:bg-action",
        "data-[disabled]:data-[state=unchecked]:border-action-disabled-border data-[disabled]:data-[state=unchecked]:bg-action-disabled-bg data-[disabled]:data-[state=checked]:border-action-disabled-border data-[disabled]:data-[state=checked]:bg-action-disabled-border",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "group/thumb pointer-events-none flex items-center justify-center rounded-full transition-[translate,width,height,background-color] duration-150 ease-out",
          "data-[state=unchecked]:size-3.5 data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:bg-fg-secondary",
          "data-[state=checked]:size-[18px] data-[state=checked]:translate-x-5 data-[state=checked]:bg-fg-inverse",
          "data-[disabled]:data-[state=unchecked]:bg-action-disabled-border"
        )}
      >
        <Check
          aria-hidden
          className="size-3 text-action group-data-[state=unchecked]/thumb:hidden group-data-[disabled]/thumb:text-fg-disabled"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
