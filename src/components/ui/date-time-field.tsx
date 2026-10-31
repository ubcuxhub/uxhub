"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"

import { DatePicker } from "@/components/ui/date-picker"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { TimePicker } from "@/components/ui/time-picker"
import { useActiveDescendant } from "@/hooks/use-active-descendant"
import { usePacificNow } from "@/hooks/use-pacific-now"
import {
  DATE_INPUT_ERROR,
  END_TIME_ERROR,
  formatDateInput,
  formatTimeInput,
  isEndBeforeStart,
  parseDateInput,
  parseTimeInput,
  timeOptions,
  type IsoDate,
  type WallTime,
} from "@/lib/date-input"
import { cn } from "@/lib/utils"

const TIME_INPUT_ERROR = "Use a real time, like 9:00 AM."

type FieldInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max"
>

interface PickerFieldProps<T extends string> extends FieldInputProps {
  value: T | null
  onValueChange: (value: T | null) => void
  /**
   * Called with the message when the text can't be read (or, for an end time,
   * falls before the start), and with `null` when it clears. The caller renders
   * the message in a `FieldError`.
   */
  onValidityChange?: (error: string | null) => void
  /** Submits the ISO value through a hidden input. */
  name?: string
}

interface DateFieldProps extends PickerFieldProps<IsoDate> {
  min?: IsoDate
  max?: IsoDate
  /** Today in Pacific time. Defaults to the live clock. */
  today?: IsoDate
  /** Start with the calendar open (for the gallery). */
  defaultOpen?: boolean
}

interface TimeFieldProps extends PickerFieldProps<WallTime> {
  /** End-time mode: options start after it and show durations. */
  after?: WallTime
  /** Minutes between options. Default 15. */
  stepMinutes?: number
  /** Start with the list open (for the gallery). */
  defaultOpen?: boolean
}

function mergeRefs<T>(...refs: React.Ref<T>[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.RefObject<T | null>).current = node
    }
  }
}

/** The text in the box, reset whenever the value changes from outside. */
function useFieldText<T extends string>(
  value: T | null,
  format: (value: T) => string
) {
  const [text, setText] = React.useState(value ? format(value) : "")
  const [seen, setSeen] = React.useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(value ? format(value) : "")
  }
  return [text, setText] as const
}

/** Reports each change of the error to the caller, but not the initial null. */
function useReportValidity(
  error: string | null,
  onValidityChange?: (error: string | null) => void
) {
  const reported = React.useRef<string | null>(null)
  const report = React.useEffectEvent((next: string | null) =>
    onValidityChange?.(next)
  )
  React.useEffect(() => {
    if (reported.current === error) return
    reported.current = error
    report(error)
  }, [error])
}

function rangeError(min?: IsoDate, max?: IsoDate) {
  if (min && max) {
    return `Pick a date from ${formatDateInput(min)} to ${formatDateInput(max)}.`
  }
  if (min) return `Pick a date on or after ${formatDateInput(min)}.`
  if (max) return `Pick a date on or before ${formatDateInput(max)}.`
  return DATE_INPUT_ERROR
}

/** Where a click is: the field's own controls must not dismiss its popover. */
const isInside = (wrapper: HTMLElement | null, target: EventTarget | null, selector: string) =>
  target instanceof Element && !!wrapper?.contains(target) && !!target.closest(selector)

const inputClass = "pr-12 in-data-[density=compact]:pr-10"
const triggerClass =
  "absolute top-1/2 right-[7px] -translate-y-1/2 in-data-[density=compact]:size-6 in-data-[density=compact]:right-[3px]"

/**
 * A date field (DS `DateTimeField`, Type=Date; §3.11). Type or pick: the text is
 * read on blur and tidied to "Sat, Nov 14, 2026". The calendar button, or
 * Alt+Down in the input, opens the picker; it focuses the selected day, Enter
 * picks, and Esc closes with focus back in the input.
 */
function DateField({
  value,
  onValueChange,
  onValidityChange,
  name,
  min,
  max,
  today: todayProp,
  defaultOpen = false,
  disabled,
  className,
  placeholder = "Sat, Nov 14, 2026",
  onBlur,
  onKeyDown,
  ref,
  ...props
}: DateFieldProps) {
  const now = usePacificNow()
  const [text, setText] = useFieldText(value, formatDateInput)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(defaultOpen)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  useReportValidity(parseError, onValidityChange)

  const today = (todayProp ?? (now?.date as IsoDate | undefined)) ?? localToday()
  // Text edits are a draft until blur or a picker selection commits them.
  // Never submit the previous value while that draft is visible.
  const submittedValue =
    value && !parseError && text === formatDateInput(value) ? value : ""

  const commit = () => {
    if (!text.trim()) {
      setParseError(null)
      if (value !== null) onValueChange(null)
      return
    }
    const parsed = parseDateInput(text, { today, min, max })
    if (!parsed) {
      // Say why: a real date outside the allowed range isn't "not a date".
      const real = parseDateInput(text, { today })
      setParseError(real ? rangeError(min, max) : DATE_INPUT_ERROR)
      return
    }
    setParseError(null)
    setText(formatDateInput(parsed))
    if (parsed !== value) onValueChange(parsed)
  }

  const pick = (date: IsoDate) => {
    setParseError(null)
    setText(formatDateInput(date))
    onValueChange(date)
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={wrapperRef}
          data-slot="date-field"
          className={cn("relative w-full", className)}
        >
          <Input
            {...props}
            ref={mergeRefs(inputRef, ref ?? null)}
            type="text"
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={parseError ? true : props["aria-invalid"]}
            className={inputClass}
            onChange={(event) => {
              setText(event.target.value)
              setParseError(null)
            }}
            onBlur={(event) => {
              onBlur?.(event)
              commit()
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event)
              if (event.defaultPrevented) return
              if (event.key === "ArrowDown" && event.altKey) {
                event.preventDefault()
                commit()
                setOpen(true)
              } else if (event.key === "Enter") {
                commit()
              }
            }}
          />
          <IconButton
            variant="ghost"
            label="Choose date"
            data-slot="date-time-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={disabled}
            className={triggerClass}
            onClick={() => setOpen((current) => !current)}
          >
            <CalendarIcon aria-hidden />
          </IconButton>
          {name ? (
            <input type="hidden" name={name} value={submittedValue} disabled={disabled} />
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Choose date"
        className="w-82 max-w-[calc(100vw-2rem)]"
        // The calendar focuses its own day; Radix would pick the first button.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => inputRef.current?.focus()}
        onInteractOutside={(event) => {
          if (isInside(wrapperRef.current, event.target, "[data-slot=date-time-trigger]")) {
            event.preventDefault()
          }
        }}
      >
        <DatePicker
          value={value}
          onValueChange={pick}
          min={min}
          max={max}
          today={today}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * A time field (DS `DateTimeField`, Type=Time; §3.11): an ARIA combobox over a
 * listbox of times. Focus stays in the input; Up and Down move through the list,
 * Enter accepts, Esc closes. A time with no AM/PM reads as PM, and in end-time
 * mode (`after`) takes the first match after the start.
 */
function TimeField({
  value,
  onValueChange,
  onValidityChange,
  name,
  after,
  stepMinutes = 15,
  defaultOpen = false,
  disabled,
  className,
  placeholder = "9:00 AM",
  onBlur,
  onKeyDown,
  ref,
  ...props
}: TimeFieldProps) {
  const [text, setText] = useFieldText(value, formatTimeInput)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(defaultOpen)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const listboxId = React.useId()

  const options = timeOptions({ after, stepMinutes })
  const { activeIndex, setActiveIndex, onKeyDown: moveActive, getOptionId } =
    useActiveDescendant(options.length, { homeEnd: false })

  const beforeStart = !!(value && after && isEndBeforeStart(value, after))
  const error = parseError ?? (beforeStart ? END_TIME_ERROR : null)
  useReportValidity(error, onValidityChange)
  // A visible draft must not submit the previous committed time.
  const submittedValue =
    value && !error && text === formatTimeInput(value) ? value : ""

  const accept = (time: WallTime) => {
    setParseError(null)
    setText(formatTimeInput(time))
    if (time !== value) onValueChange(time)
  }

  const commit = () => {
    if (!text.trim()) {
      setParseError(null)
      if (value !== null) onValueChange(null)
      return
    }
    const parsed = parseTimeInput(text, { after })
    if (!parsed) {
      setParseError(TIME_INPUT_ERROR)
      return
    }
    accept(parsed)
  }

  const openList = () => {
    const parsed = text.trim() ? parseTimeInput(text, { after }) : value
    const index = parsed ? options.findIndex((o) => o.value === parsed) : -1
    setActiveIndex(index)
    setOpen(true)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={wrapperRef}
          data-slot="time-field"
          className={cn("relative w-full", className)}
        >
          <Input
            {...props}
            ref={mergeRefs(inputRef, ref ?? null)}
            type="text"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="none"
            aria-activedescendant={
              open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined
            }
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : props["aria-invalid"]}
            className={inputClass}
            onChange={(event) => {
              const next = event.target.value
              setText(next)
              setParseError(null)
              // Follow the typing: the matching option lights up, so Enter
              // accepts what was typed.
              const parsed = next.trim() ? parseTimeInput(next, { after }) : null
              setActiveIndex(parsed ? options.findIndex((o) => o.value === parsed) : -1)
            }}
            onBlur={(event) => {
              onBlur?.(event)
              commit()
              setOpen(false)
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event)
              if (event.defaultPrevented) return
              if (!open) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault()
                  openList()
                } else if (event.key === "Enter") {
                  commit()
                }
                return
              }
              moveActive(event)
              if (event.key === "Enter") {
                const option = options[activeIndex]
                if (option) {
                  event.preventDefault()
                  accept(option.value)
                } else {
                  commit()
                }
                setOpen(false)
              }
            }}
          />
          <IconButton
            variant="ghost"
            label="Choose time"
            data-slot="date-time-trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
            className={triggerClass}
            // Keep focus in the input, where the list is driven from.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              inputRef.current?.focus()
              if (open) setOpen(false)
              else openList()
            }}
          >
            <ClockIcon aria-hidden />
          </IconButton>
          {name ? (
            <input type="hidden" name={name} value={submittedValue} disabled={disabled} />
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-60 max-w-[calc(100vw-2rem)] p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (isInside(wrapperRef.current, event.target, "input, [data-slot=date-time-trigger]")) {
            event.preventDefault()
          }
        }}
      >
        <TimePicker
          id={listboxId}
          label={after ? "End time" : "Start time"}
          options={options}
          value={value}
          onValueChange={(time) => {
            accept(time)
            setOpen(false)
            inputRef.current?.focus()
          }}
          activeIndex={activeIndex}
          getOptionId={getOptionId}
        />
      </PopoverContent>
    </Popover>
  )
}

/** The browser's date, only used before the Pacific clock has hydrated. */
function localToday(): IsoDate {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` as IsoDate
}

export { DateField, TimeField, TIME_INPUT_ERROR }
export type { DateFieldProps, TimeFieldProps }
