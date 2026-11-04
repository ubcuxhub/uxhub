// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TimePicker, type TimePickerOption } from "./time-picker"

const options: TimePickerOption[] = [
  { value: "09:00", label: "9:00 AM" },
  { value: "09:30", label: "9:30 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
]
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView"
)

afterEach(() => {
  cleanup()
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  }
})

describe("TimePicker", () => {
  it("does not scroll page ancestors when an option is highlighted on mount", () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    render(
      <TimePicker
        options={options}
        value={null}
        activeIndex={5}
        onValueChange={vi.fn()}
      />
    )

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("scrolls only its list to keep the highlighted row visible", () => {
    const { rerender } = render(
      <TimePicker
        options={options}
        value={null}
        activeIndex={-1}
        onValueChange={vi.fn()}
      />
    )
    const list = screen.getByRole("listbox")
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 100 })
    const rows = screen.getAllByRole("option")
    Object.defineProperty(rows[5], "offsetTop", { configurable: true, value: 210 })
    Object.defineProperty(rows[5], "offsetHeight", { configurable: true, value: 40 })
    Object.defineProperty(rows[1], "offsetTop", { configurable: true, value: 42 })
    Object.defineProperty(rows[1], "offsetHeight", { configurable: true, value: 40 })

    rerender(
      <TimePicker
        options={options}
        value={null}
        activeIndex={5}
        onValueChange={vi.fn()}
      />
    )
    expect(list.scrollTop).toBe(150)

    rerender(
      <TimePicker
        options={options}
        value={null}
        activeIndex={1}
        onValueChange={vi.fn()}
      />
    )
    expect(list.scrollTop).toBe(42)
  })
})
