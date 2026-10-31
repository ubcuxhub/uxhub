import * as React from "react"

interface UseActiveDescendantOptions {
  /** Wrap from the last option to the first and back. Default false. */
  loop?: boolean
  /** Handle Home and End. Turn off where the input needs them for its caret. */
  homeEnd?: boolean
}

/**
 * The bookkeeping for an ARIA 1.2 combobox that keeps focus in its input and
 * points at the highlighted option with `aria-activedescendant`. Spread
 * `onKeyDown` onto the input, set `aria-activedescendant` from
 * `getOptionId(activeIndex)` (undefined at -1) and give each option that id.
 *
 * Handles Up and Down (and Home and End); Enter and Escape are left to the
 * caller, which knows what accepting and closing mean.
 */
export function useActiveDescendant(
  count: number,
  { loop = false, homeEnd = true }: UseActiveDescendantOptions = {},
) {
  const baseId = React.useId()
  const [index, setIndex] = React.useState(-1)
  // A shrinking list can strand the index past the end.
  const activeIndex = index < count ? index : -1

  const getOptionId = (i: number) => `${baseId}-option-${i}`

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (count === 0) return
    const last = count - 1

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setIndex(activeIndex < last ? activeIndex + 1 : loop ? 0 : last)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setIndex(activeIndex > 0 ? activeIndex - 1 : loop ? last : 0)
    } else if (homeEnd && event.key === "Home") {
      event.preventDefault()
      setIndex(0)
    } else if (homeEnd && event.key === "End") {
      event.preventDefault()
      setIndex(last)
    }
  }

  return {
    activeIndex,
    setActiveIndex: setIndex,
    onKeyDown,
    getOptionId,
  }
}
