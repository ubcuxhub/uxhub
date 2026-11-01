"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * How the last input arrived. Radix opens a tooltip on any `focus`, with no
 * delay, so focus handed back by a menu or dialog (`element.focus()` after a
 * mouse click) would pop it. Browsers show a focus ring only after keyboard
 * use, and the tooltip follows the same rule: it opens on focus only when the
 * last input was the keyboard (or nothing has been pressed yet). Hover still
 * opens it either way.
 */
let keyboardModality = true
let watchingModality = false

function watchInputModality() {
  if (watchingModality || typeof document === "undefined") return
  watchingModality = true
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      keyboardModality = true
    },
    true
  )
  for (const type of ["pointerdown", "mousedown", "touchstart"]) {
    document.addEventListener(type, () => (keyboardModality = false), true)
  }
}
watchInputModality()

function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/** Wraps its own provider, so a Tooltip works anywhere without a parent. */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  onFocus,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onFocus={(event) => {
        onFocus?.(event)
        // Radix skips its focus-open when the event is default-prevented.
        if (!keyboardModality) event.preventDefault()
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in overlay-surface rounded-lg px-3 py-1.5 text-small text-balance duration-200 ease-out fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
