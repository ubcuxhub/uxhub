"use client"

import * as React from "react"

import { minutesOf, type WallTime } from "@/lib/date-input"
import { cn } from "@/lib/utils"

interface TimePickerOption {
  value: WallTime
  label: string
  /** "2 hr 15 min", shown at the right of an end-time option. */
  duration?: string
}

interface TimePickerProps {
  options: readonly TimePickerOption[]
  value: WallTime | null
  onValueChange: (time: WallTime) => void
  /** The keyboard-highlighted option, when focus stays in a combobox input. */
  activeIndex?: number
  /** Ids for `aria-activedescendant`; from `useActiveDescendant`. */
  getOptionId?: (index: number) => string
  /** The listbox's id, for the input's `aria-controls`. */
  id?: string
  label?: string
  /**
   * Where the list opens when `value` isn't on it: the option nearest this.
   * Defaults to 9:00 AM, or the first option in end-time mode.
   */
  scrollTarget?: WallTime | null
  className?: string
}

const DEFAULT_SCROLL_TARGET: WallTime = "09:00"

function nearestIndex(options: readonly TimePickerOption[], target: WallTime) {
  const minutes = minutesOf(target)
  let best = -1
  let bestDistance = Infinity
  options.forEach((option, i) => {
    const distance = Math.abs(minutesOf(option.value) - minutes)
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

/**
 * The time list under a time field (§3.11): 40px rows with a "Pacific Time"
 * footer. It is a listbox whose options are never focused; the field's input
 * keeps focus and points at the highlighted row with `aria-activedescendant`.
 * Like `DatePicker` it draws no surface of its own.
 */
function TimePicker({
  options,
  value,
  onValueChange,
  activeIndex = -1,
  getOptionId,
  id,
  label = "Times",
  scrollTarget,
  className,
}: TimePickerProps) {
  const fallbackId = React.useId()
  const listboxId = id ?? fallbackId
  const optionId = getOptionId ?? ((i: number) => `${listboxId}-option-${i}`)
  const listRef = React.useRef<HTMLUListElement>(null)

  // Open centred on the selected time, or the nearest one to where the user is.
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = value ? options.findIndex((o) => o.value === value) : -1
    const index =
      selected !== -1
        ? selected
        : nearestIndex(options, scrollTarget ?? (value ?? DEFAULT_SCROLL_TARGET))
    const row = list.children[index] as HTMLElement | undefined
    if (!row) return
    list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2
    // Only on mount: later scrolling follows the highlighted row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (activeIndex < 0) return
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined
    row?.scrollIntoView?.({ block: "nearest" })
  }, [activeIndex])

  return (
    <div
      data-slot="time-picker"
      className={cn("flex w-full flex-col gap-1", className)}
    >
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={label}
        className="relative m-0 flex max-h-73 list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        {options.map((option, i) => {
          const selected = option.value === value
          return (
            <li
              key={option.value}
              id={optionId(i)}
              role="option"
              aria-selected={selected}
              data-active={i === activeIndex || undefined}
              // Keep focus in the input.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "flex h-10 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-small text-foreground transition-colors duration-150 select-none hover:bg-muted data-[active]:bg-muted",
                selected &&
                  "bg-primary font-medium text-primary-foreground hover:bg-primary-hover data-[active]:bg-primary-hover"
              )}
            >
              <span>{option.label}</span>
              {option.duration ? (
                <span
                  className={cn(
                    "text-badge font-normal",
                    selected ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {option.duration}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="border-t border-border-subtle px-1 pt-2 pb-1 text-badge font-normal text-muted-foreground">
        Pacific Time
      </p>
    </div>
  )
}

export { TimePicker }
export type { TimePickerOption, TimePickerProps }
