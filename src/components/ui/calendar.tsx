"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { cn } from "@/lib/utils"

const navButton =
  "inline-flex size-(--cell-size) cursor-pointer items-center justify-center rounded-full p-0 text-fg-secondary select-none transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:text-fg-disabled"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-background p-3 [--cell-size:--spacing(10)] sm:[--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          navButton,
          defaultClassNames.button_previous
        ),
        button_next: cn(
          navButton,
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-table",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-full border border-border bg-background transition-colors duration-150 hover:bg-surface-subtle has-focus-visible:focus-ring",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none",
          captionLayout === "label"
            ? "text-table"
            : "flex h-8 items-center gap-1 rounded-full pr-2 pl-3 text-table [&>svg]:size-3.5 [&>svg]:text-fg-secondary",
          defaultClassNames.caption_label
        ),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 text-label text-fg-secondary select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-label text-fg-secondary select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-full",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-full"
            : "[&:first-child[data-selected=true]_button]:rounded-l-full",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-full bg-surface-subtle",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-full bg-surface-subtle", defaultClassNames.range_end),
        today: cn(defaultClassNames.today),
        outside: cn(
          "text-fg-disabled aria-selected:text-fg-disabled",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-fg-disabled",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-today={modifiers.today && !modifiers.selected}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-full text-small leading-none text-foreground transition-colors duration-150 hover:bg-surface-subtle focus-visible:focus-ring disabled:pointer-events-none disabled:text-fg-disabled data-[today=true]:ring-1 data-[today=true]:ring-inset data-[today=true]:ring-border data-[selected-single=true]:bg-action data-[selected-single=true]:text-fg-inverse data-[selected-single=true]:hover:bg-action-hover data-[range-start=true]:bg-action data-[range-start=true]:text-fg-inverse data-[range-start=true]:hover:bg-action-hover data-[range-end=true]:bg-action data-[range-end=true]:text-fg-inverse data-[range-end=true]:hover:bg-action-hover data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-surface-subtle data-[range-middle=true]:hover:bg-border-subtle group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 [&>span]:text-small [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
