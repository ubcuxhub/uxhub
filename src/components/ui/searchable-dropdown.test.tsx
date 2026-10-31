// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

import { SearchableDropdown, highlightMatch, type SearchableOption } from "./searchable-dropdown"

const options: SearchableOption[] = [
  { value: "priya", label: "Priya Shah", keywords: ["researcher"] },
  { value: "prisha", label: "Prisha Rao" },
  { value: "alex", label: "Alex Chen" },
]

afterEach(cleanup)

function Single() {
  const [value, setValue] = useState<string | null>(null)
  return <SearchableDropdown options={options} placeholder="Search members" value={value} onValueChange={setValue} name="judge" />
}

function Multiple() {
  const [value, setValue] = useState<string[]>(["alex"])
  return <SearchableDropdown options={options} multiple placeholder="Add a judge" value={value} onValueChange={setValue} name="judges" />
}

describe("highlightMatch", () => {
  it("matches without case or accents and marks repeated hits", () => {
    const { container } = render(<>{highlightMatch("Éléonore éLe", "ele")}</>)
    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["Élé", "éLe"])
  })
})

describe("SearchableDropdown", () => {
  it("filters labels and keywords and exposes active descendants", () => {
    render(<Single />)
    const input = screen.getByRole("combobox")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    fireEvent.focus(input)
    expect(input.getAttribute("aria-expanded")).toBe("true")
    fireEvent.change(input, { target: { value: "pri" } })
    expect(screen.getAllByRole("option")).toHaveLength(2)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0].id)
    expect(screen.getByRole("status").textContent).toContain("2 matches")
    fireEvent.change(input, { target: { value: "researcher" } })
    expect(screen.getAllByRole("option")).toHaveLength(1)
  })

  it("scrolls only the list to reveal the active option", () => {
    render(<Single />)
    const input = screen.getByRole("combobox")
    fireEvent.focus(input)
    const list = screen.getByRole("listbox") as HTMLElement
    const rows = screen.getAllByRole("option")
    const scrollIntoView = vi.fn()
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 80 })
    Object.defineProperty(rows[1], "offsetTop", { configurable: true, value: 120 })
    Object.defineProperty(rows[1], "offsetHeight", { configurable: true, value: 40 })
    Object.defineProperty(rows[1], "scrollIntoView", { configurable: true, value: scrollIntoView })

    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(list.scrollTop).toBe(80)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("chooses with Enter and submits the single hidden value", () => {
    render(<Single />)
    const input = screen.getByRole("combobox")
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelector('input[name="judge"]')?.getAttribute("value")).toBe("priya")
  })

  it("keeps multiple selection open, submits each value and removes the last chip", () => {
    render(<Multiple />)
    const input = screen.getByRole("combobox")
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "pri" } })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(input.getAttribute("aria-expanded")).toBe("true")
    expect([...document.querySelectorAll('input[name="judges"]')].map((node) => node.getAttribute("value"))).toEqual(["alex", "priya"])
    fireEvent.keyDown(input, { key: "Backspace" })
    expect(screen.queryByRole("button", { name: "Remove Priya Shah" })).toBeNull()
    expect(screen.getByRole("status").textContent).toContain("Priya Shah removed")
    expect([...document.querySelectorAll('input[name="judges"]')].map((node) => node.getAttribute("value"))).toEqual(["alex"])
  })

  it("closes on Escape, then clears the query on a second Escape", () => {
    render(<Single />)
    const input = screen.getByRole("combobox") as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "xyz" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("xyz")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("")
  })
})
