"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { joinIds, useFieldControl } from "@/components/ui/field"

/** The counter speaks (politely) once this many characters or fewer are left. */
const LIVE_THRESHOLD = 20

const length = (text: string) => [...text].length

type TextareaProps = React.ComponentProps<"textarea"> & {
  /**
   * Shows "84/280" under the field, right-aligned. Needs `maxLength`; without
   * one it is ignored and the markup is the bare `<textarea>`.
   */
  showCount?: boolean
  /** Classes for the wrapper that `showCount` adds. `className` stays on the textarea. */
  wrapperClassName?: string
}

function Textarea({
  className,
  showCount,
  wrapperClassName,
  maxLength,
  value,
  defaultValue,
  onChange,
  "aria-describedby": describedByProp,
  "aria-invalid": invalidProp,
  ref,
  ...props
}: TextareaProps) {
  const counterId = React.useId()
  const fieldControl = useFieldControl()
  const describedBy = joinIds(describedByProp, fieldControl.describedBy)
  const invalid = invalidProp ?? fieldControl.invalid
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  const [tracked, setTracked] = React.useState(() =>
    length(String(defaultValue ?? ""))
  )
  const counting = Boolean(showCount && maxLength)

  // `form.reset()` (and React's reset after a `<form action>`) changes the value
  // without a `change` event, so the uncontrolled count is read again after it.
  React.useEffect(() => {
    const textarea = innerRef.current
    const form = textarea?.form
    if (!counting || !textarea || !form) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const resync = () => {
      // The event fires before the fields are reset.
      clearTimeout(timer)
      timer = setTimeout(() => setTracked(length(textarea.value)), 0)
    }
    form.addEventListener("reset", resync)
    return () => {
      form.removeEventListener("reset", resync)
      clearTimeout(timer)
    }
  }, [counting])

  const field = (
    <textarea
      ref={setRef}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-2xl border border-border bg-background px-5 py-3 text-body text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground",
        className
      )}
      maxLength={maxLength}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => {
        if (counting) setTracked(length(event.target.value))
        onChange?.(event)
      }}
      aria-invalid={invalid}
      aria-describedby={
        counting ? joinIds(describedBy, counterId) : describedBy
      }
      {...props}
    />
  )

  if (!counting || !maxLength) return field

  const count = value === undefined ? tracked : length(String(value))
  const remaining = Math.max(maxLength - count, 0)
  const alarming = remaining === 0 || (Boolean(invalid) && invalid !== "false")

  return (
    <div
      data-slot="textarea-wrapper"
      className={cn("flex w-full flex-col gap-2", wrapperClassName)}
    >
      {field}
      <p
        id={counterId}
        data-slot="textarea-count"
        className={cn(
          "text-right text-xs leading-4 tabular-nums",
          alarming ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {count}/{maxLength}
      </p>
      <span aria-live="polite" className="sr-only">
        {remaining === 0
          ? "Character limit reached"
          : remaining <= LIVE_THRESHOLD
            ? `${remaining} ${remaining === 1 ? "character" : "characters"} left`
            : ""}
      </span>
    </div>
  )
}

export { Textarea }
