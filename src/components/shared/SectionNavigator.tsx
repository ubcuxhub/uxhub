"use client"

import * as React from "react"
import { AlertCircle, Check, ChevronDown } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type SectionState = "complete" | "attention" | "not-started" | "optional"

export interface NavigatorSection {
  id: string
  title: string
  state: SectionState
  issues?: number
  required: boolean
}

export interface SectionNavigatorProps {
  title: string
  sections: readonly NavigatorSection[]
  currentId: string
  onNavigate?: (id: string) => void
  className?: string
  defaultOpen?: boolean
}

function SectionMark({ state, size = "menu" }: { state: SectionState; size?: "menu" | "pill" }) {
  const sizeClass = size === "pill" ? "size-4" : "size-[18px]"
  if (state === "complete") return <span role="img" aria-label="Complete" className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-success-solid text-primary-foreground", sizeClass)}><Check aria-hidden className="size-3 stroke-[2.5]" /></span>
  if (state === "attention") return <span role="img" aria-label="Needs attention" className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground", sizeClass)}><AlertCircle aria-hidden className="size-3.5 stroke-[2.5]" /></span>
  return <span role="img" aria-label={state === "optional" ? "Optional" : "Not started"} className={cn("inline-block shrink-0 rounded-full border-[1.5px] border-border", state === "optional" && "border-dashed", sizeClass)} />
}

export function SectionNavigator({ title, sections, currentId, onNavigate, className, defaultOpen }: SectionNavigatorProps) {
  const currentIndex = Math.max(0, sections.findIndex((section) => section.id === currentId))
  const current = sections[currentIndex]
  const required = sections.filter((section) => section.required)
  const completed = required.filter((section) => section.state === "complete").length
  const issueCount = current?.issues ?? 0
  const progress = required.length ? completed / required.length : 0
  const circumference = 2 * Math.PI * 16
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const headingToFocus = React.useRef<HTMLElement | null>(null)
  const navigate = (id: string) => {
    if (onNavigate) { onNavigate(id); return }
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ block: "start" })
    const heading = target.matches("h1,h2,h3,h4,h5,h6") ? target : target.querySelector<HTMLElement>("h1,h2,h3,h4,h5,h6")
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1
      headingToFocus.current = heading
    }
  }

  if (!current) return null
  const accessibleName = `${current.title}, section ${currentIndex + 1} of ${sections.length}${issueCount ? `, ${issueCount} ${issueCount === 1 ? "issue" : "issues"}` : ""}. ${completed} of ${required.length} required sections done`

  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={accessibleName} className={cn("fixed bottom-6 left-1/2 z-50 flex h-14 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-popover py-2 pr-4 pl-2 text-foreground shadow-lg hover:bg-accent focus-visible:focus-ring", className)}>
        <span className="relative flex size-10 shrink-0 items-center justify-center" aria-hidden>
          <svg className="absolute inset-0 size-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circumference * progress} ${circumference}`} className="text-primary" />
          </svg>
          <span className="text-label font-semibold tabular-nums">{String(currentIndex + 1).padStart(2, "0")}</span>
        </span>
        <span className="min-w-0 truncate text-small font-semibold">{current.title}</span>
        {issueCount > 0 ? <span className="flex shrink-0 items-center gap-1 text-label text-destructive"><AlertCircle aria-hidden className="size-3.5" />{issueCount} {issueCount === 1 ? "issue" : "issues"}</span> : null}
        <span className="shrink-0 text-label tabular-nums text-muted-foreground">{String(currentIndex + 1).padStart(2, "0")}/{String(sections.length).padStart(2, "0")}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-[min(360px,calc(100vw-2rem))] p-2 pt-3" onCloseAutoFocus={(event) => {
      if (!headingToFocus.current) return
      event.preventDefault()
      const heading = headingToFocus.current
      headingToFocus.current = null
      requestAnimationFrame(() => heading.focus({ preventScroll: true }))
    }}>
      <div className="px-3 pb-3">
        <div className="flex items-baseline justify-between gap-3"><span className="text-small font-semibold text-foreground">{title}</span><span className="text-label text-muted-foreground">{completed} of {required.length} required done</span></div>
        <div role="progressbar" aria-label="Required sections completed" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={completed} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <div className="space-y-0.5">{sections.map((section, index) => <DropdownMenuItem key={section.id} aria-current={section.id === current.id ? "step" : undefined} onSelect={() => navigate(section.id)} className="h-10 min-h-10 gap-3 rounded-lg px-3 aria-[current=step]:bg-muted">
        <span className="w-5 shrink-0 text-label tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1 truncate text-small">{section.title}</span>
        {section.issues ? <span className="shrink-0 text-label text-destructive">{section.issues} {section.issues === 1 ? "issue" : "issues"}</span> : null}
        <SectionMark state={section.state} />
      </DropdownMenuItem>)}</div>
    </DropdownMenuContent>
  </DropdownMenu>
}
