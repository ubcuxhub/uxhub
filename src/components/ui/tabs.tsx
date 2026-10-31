"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Sections of one object (Overview, Registrations 128, Teams 32). Radix owns
 * the roles, arrow keys, Home/End and automatic activation.
 *
 * ```tsx
 * <Tabs defaultValue="overview">
 *   <TabsList aria-label="Event sections">
 *     <TabsTrigger value="overview">Overview</TabsTrigger>
 *     <TabsTrigger value="registrations" count={128}>Registrations</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="overview">…</TabsContent>
 * </Tabs>
 * ```
 *
 * Give `TabsList` an `aria-label`, since the tabs alone don't say what they
 * switch between.
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex max-w-full min-w-0 flex-col", className)}
      {...props}
    />
  )
}

/**
 * Scrolls sideways when the tabs don't fit (phones). The padding keeps the
 * focus ring from being clipped by the scroll container.
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex max-w-full items-center gap-1 self-start overflow-x-auto scroll-px-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

/**
 * The pill look shared by `TabsTrigger` and `TabNavLink`. `active` picks which
 * attribute marks the selected pill: Radix's `data-state="active"` (Tabs) or
 * `aria-current="page"` (route-based TabNav).
 */
const tabsTriggerVariants = cva(
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-button whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:focus-ring disabled:pointer-events-none disabled:text-disabled-foreground disabled:[&>[data-slot=tabs-trigger-count]]:text-disabled-foreground sm:h-(--size-control)",
  {
    variants: {
      active: {
        state:
          "data-[state=active]:bg-muted data-[state=active]:text-foreground",
        current:
          "aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
      },
    },
    defaultVariants: { active: "state" },
  }
)

interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  /** Shown after the label in secondary text, and read as part of the name. */
  count?: number
}

function TabsTrigger({
  className,
  children,
  count,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants(), className)}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <>
          {" "}
          <span
            data-slot="tabs-trigger-count"
            className="ml-1.5 tabular-nums text-muted-foreground"
          >
            {count}
          </span>
        </>
      ) : null}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("mt-6 rounded-md focus-visible:focus-ring", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsTriggerVariants }
export type { TabsTriggerProps }
