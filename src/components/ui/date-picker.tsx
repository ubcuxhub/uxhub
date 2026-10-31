"use client"

import * as React from "react"
import { type DayButton } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { type IsoDate } from "@/lib/date-input"
import { usePacificNow } from "@/hooks/use-pacific-now"
import { cn } from "@/lib/utils"

/** `IsoDate` to a local-midnight `Date`, which is what react-day-picker wants. */
function isoToLocalDate(iso: IsoDate) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function localDateToIso(date: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as IsoDate
}

/** The calendar's own day button: a 40px circle (`DatePicker/Day`, §3.11). */
function PickerDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected={modifiers.selected || undefined}
      data-today={(modifiers.today && !modifiers.selected) || undefined}
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center rounded-full border border-transparent text-small text-foreground transition-colors duration-150 select-none hover:bg-muted focus-visible:focus-ring disabled:pointer-events-none disabled:text-disabled-foreground data-[today]:border-border data-[selected]:bg-primary data-[selected]:font-medium data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary-hover",
        className
      )}
      {...props}
    />
  )
}

const navButton =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-card p-0 text-foreground transition-colors duration-150 hover:bg-muted focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:text-disabled-foreground aria-disabled:opacity-50"

interface DatePickerProps {
  value: IsoDate | null
  onValueChange: (date: IsoDate) => void
  /** Earlier days are shown dimmed and can't be picked. */
  min?: IsoDate
  /** Later days are shown dimmed and can't be picked. */
  max?: IsoDate
  /** Today in Pacific time. Defaults to the live clock. */
  today?: IsoDate
  /** Move focus to the selected day (or today) on mount. */
  autoFocus?: boolean
  className?: string
}

/**
 * The calendar panel under a date field (§3.11): month header with 36px
 * chevrons, weekday letters, a grid of 40px days, and a footer with the typing
 * hint and a Today link. It draws no surface of its own; the field puts it in a
 * popover, and the gallery wraps it in `overlay-surface` to show it inline.
 *
 * The grid is react-day-picker's: arrows move by day and week, Page Up/Down by
 * month, Home/End to the week's ends, Enter or Space picks.
 */
function DatePicker({
  value,
  onValueChange,
  min,
  max,
  today: todayProp,
  autoFocus,
  className,
}: DatePickerProps) {
  const now = usePacificNow()
  const today = todayProp ?? (now?.date as IsoDate | undefined)
  const todayDate = today ? isoToLocalDate(today) : undefined
  const selected = value ? isoToLocalDate(value) : undefined
  const todayDisabled = today
    ? (min !== undefined && today < min) || (max !== undefined && today > max)
    : true

  return (
    <div data-slot="date-picker" className={cn("flex w-full flex-col gap-2", className)}>
      <Calendar
        mode="single"
        required
        selected={selected}
        onSelect={(date) => onValueChange(localDateToIso(date))}
        defaultMonth={selected ?? todayDate}
        today={todayDate}
        startMonth={min ? isoToLocalDate(min) : undefined}
        endMonth={max ? isoToLocalDate(max) : undefined}
        disabled={[
          ...(min ? [{ before: isoToLocalDate(min) }] : []),
          ...(max ? [{ after: isoToLocalDate(max) }] : []),
        ]}
        showOutsideDays={false}
        autoFocus={autoFocus}
        className="w-full bg-transparent p-0"
        formatters={{
          formatWeekdayName: (date) =>
            date.toLocaleDateString("en-CA", { weekday: "narrow" }),
        }}
        classNames={{
          root: "w-full",
          months: "relative flex w-full flex-col gap-2",
          month: "flex w-full flex-col gap-2",
          nav: "absolute inset-x-0 top-0 flex h-9 w-full items-center justify-between",
          button_previous: navButton,
          button_next: navButton,
          month_caption: "flex h-9 w-full items-center justify-center px-11",
          caption_label: "text-body-medium text-foreground select-none",
          month_grid: "w-full border-collapse",
          weekdays: "flex w-full justify-between",
          weekday:
            "flex h-8 w-10 items-center justify-center text-badge text-muted-foreground select-none",
          weeks: "flex flex-col gap-0.5",
          week: "flex w-full justify-between",
          day: "flex size-10 items-center justify-center p-0 text-center",
        }}
        components={{ DayButton: PickerDayButton }}
      />
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
        <p className="text-badge font-normal text-muted-foreground">
          Or type one, like Nov 14
        </p>
        <button
          type="button"
          disabled={todayDisabled}
          onClick={() => today && onValueChange(today)}
          className="cursor-pointer rounded-sm text-small font-medium text-foreground underline underline-offset-2 hover:text-primary-hover focus-visible:focus-ring disabled:pointer-events-none disabled:text-disabled-foreground disabled:no-underline"
        >
          Today
        </button>
      </div>
    </div>
  )
}

export { DatePicker, isoToLocalDate, localDateToIso }
export type { DatePickerProps }
