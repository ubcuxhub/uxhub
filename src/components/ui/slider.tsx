"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type SliderName =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-labelledby": string; "aria-label"?: string }

type SliderProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "size" | "min" | "max" | "step"
> &
  SliderName & {
    value?: number
    defaultValue?: number
    /** Fires on every move, so a preview can follow the thumb. */
    onValueChange?: (value: number) => void
    min?: number
    max?: number
    step?: number
    /** "140%". Shown beside the track and read out as `aria-valuetext`. */
    formatValue?: (value: number) => string
    /** Default true. */
    showValue?: boolean
  }

const PAGE_STEPS = 10

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length

/** Rounds to the nearest step from `min`, trimming float noise. */
function snap(value: number, min: number, max: number, step: number) {
  const stepped = Math.round((value - min) / step) * step + min
  const places = Math.max(decimals(step), decimals(min))
  return Math.min(max, Math.max(min, Number(stepped.toFixed(places))))
}

/**
 * Picks a number in a range (§3.17): a native `<input type="range">`, so
 * arrows (one step), Home and End come for free; Page Up and Down move ten
 * steps. `className` lands on the root; everything else goes to the input.
 */
function Slider({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = String,
  showValue = true,
  disabled,
  id: idProp,
  onKeyDown,
  ref,
  ...props
}: SliderProps) {
  const generatedId = React.useId()
  const id = idProp ?? generatedId
  const [inner, setInner] = React.useState(defaultValue ?? min)
  const value = valueProp ?? inner

  const commit = (next: number) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }

  const ratio = max > min ? (value - min) / (max - min) : 0

  return (
    <div
      data-slot="slider"
      className={cn("flex w-full items-center gap-3", className)}
    >
      <input
        {...props}
        ref={ref}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={formatValue(value)}
        style={
          {
            "--fill": `calc(var(--slider-thumb) / 2 + (100% - var(--slider-thumb)) * ${ratio})`,
          } as React.CSSProperties
        }
        onChange={(event) => commit(Number(event.target.value))}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key !== "PageUp" && event.key !== "PageDown") return
          event.preventDefault()
          const delta = PAGE_STEPS * step * (event.key === "PageUp" ? 1 : -1)
          const next = snap(value + delta, min, max, step)
          if (next !== value) commit(next)
        }}
        className={cn(
          // 44px hit area; the visible track and thumb are drawn by the pseudo-elements.
          "peer m-0 h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent outline-none [--slider-fill:var(--primary)] [--slider-thumb:20px] [--slider-track:var(--border)]",
          "disabled:cursor-not-allowed disabled:[--slider-fill:var(--text-disabled)] disabled:[--slider-track:var(--action-disabled-background)]",
          // WebKit and Blink.
          "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--slider-fill)_var(--fill),var(--slider-track)_var(--fill))]",
          "[&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-(--slider-fill) [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgb(17_17_17/0.16)]",
          "focus-visible:[&::-webkit-slider-thumb]:shadow-none focus-visible:[&::-webkit-slider-thumb]:focus-ring",
          // Gecko.
          "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-(--slider-track)",
          "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-(--slider-fill)",
          "[&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-(--slider-fill) [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-[0_1px_2px_rgb(17_17_17/0.16)]",
          "focus-visible:[&::-moz-range-thumb]:shadow-none focus-visible:[&::-moz-range-thumb]:focus-ring"
        )}
      />
      {showValue ? (
        <output
          htmlFor={id}
          aria-live="off"
          className="w-11 shrink-0 text-right text-small text-muted-foreground tabular-nums peer-disabled:text-text-disabled"
        >
          {formatValue(value)}
        </output>
      ) : null}
    </div>
  )
}

export { Slider }
export type { SliderProps }
