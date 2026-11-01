// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
    fireEvent.click(input)
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
    fireEvent.click(input)
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
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelector('input[name="judge"]')?.getAttribute("value")).toBe("priya")
  })

  it("keeps multiple selection open, submits each value and removes the last chip", () => {
    render(<Multiple />)
    const input = screen.getByRole("combobox")
    fireEvent.click(input)
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

  it("keeps selected labels and controls when async results replace the options", () => {
    const onSingleChange = vi.fn()
    const onMultipleChange = vi.fn()
    const queryChange = vi.fn()
    const { rerender } = render(<>
      <SearchableDropdown options={options} placeholder="Search members" value="priya" onValueChange={onSingleChange} onQueryChange={queryChange} />
      <SearchableDropdown options={options} multiple placeholder="Add a judge" value={["alex"]} onValueChange={onMultipleChange} onQueryChange={queryChange} />
    </>)

    rerender(<>
      <SearchableDropdown options={[]} placeholder="Search members" value="priya" onValueChange={onSingleChange} onQueryChange={queryChange} />
      <SearchableDropdown options={[]} multiple placeholder="Add a judge" value={["alex"]} onValueChange={onMultipleChange} onQueryChange={queryChange} />
    </>)
    expect(screen.getByText("Priya Shah")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Clear Priya Shah" })).toBeTruthy()
    expect(screen.getByText("Alex Chen")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove Alex Chen" }))
    expect(onMultipleChange).toHaveBeenCalledWith([])
  })

  it("falls back to the value if the selected option was never loaded", () => {
    render(<SearchableDropdown options={[]} placeholder="Search members" value="unknown" onValueChange={vi.fn()} onQueryChange={vi.fn()} />)
    expect(screen.getByText("unknown")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Clear unknown" })).toBeTruthy()
  })

  it("closes on Escape, then clears the query on a second Escape", () => {
    render(<Single />)
    const input = screen.getByRole("combobox") as HTMLInputElement
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: "xyz" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("xyz")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("")
  })

  it("marks the input so overlays leave Escape to it, and Escape clears the query", () => {
    render(<Single />)
    const input = screen.getByRole("combobox") as HTMLInputElement
    expect(input.hasAttribute("data-escape-clears")).toBe(true)
    fireEvent.change(input, { target: { value: "xyz" } })
    fireEvent.keyDown(input, { key: "Escape" })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("")
  })

  it("lets a visible label name the field and the list", () => {
    render(<>
      <label htmlFor="mentors">Mentors</label>
      <SearchableDropdown id="mentors" options={options} placeholder="Search people" value={null} onValueChange={vi.fn()} />
    </>)
    expect(screen.getByRole("combobox", { name: "Mentors" })).toBeTruthy()
    fireEvent.click(screen.getByRole("combobox"))
    expect(screen.getByRole("listbox", { name: "Mentors" })).toBeTruthy()
  })

  it("uses aria-labelledby over the placeholder", () => {
    render(<>
      <span id="lbl">Reviewer</span>
      <SearchableDropdown options={options} placeholder="Search people" aria-labelledby="lbl" value={null} onValueChange={vi.fn()} />
    </>)
    expect(screen.getByRole("combobox", { name: "Reviewer" })).toBeTruthy()
  })

  it("leaves Home and End to the caret", () => {
    render(<Single />)
    const input = screen.getByRole("combobox")
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: "Home" })
    fireEvent.keyDown(input, { key: "End" })
    expect(input.getAttribute("aria-activedescendant")).toBeNull()
  })

  it("does not submit the form on Enter without a highlighted option", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(<form onSubmit={onSubmit}><Single /></form>)
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "pri" } })
    const notPrevented = fireEvent.keyDown(input, { key: "Enter" })
    expect(notPrevented).toBe(false)
    expect((input as HTMLInputElement).value).toBe("pri")
  })

  it("chooses the only match on Enter", () => {
    render(<Single />)
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "alex" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(document.querySelector('input[name="judge"]')?.getAttribute("value")).toBe("alex")
  })

  it("reverts an uncommitted query on blur and Tab", () => {
    const onQueryChange = vi.fn()
    render(<SearchableDropdown options={options} placeholder="Search members" value="alex" onValueChange={vi.fn()} onQueryChange={onQueryChange} />)
    const input = screen.getByRole("combobox") as HTMLInputElement
    fireEvent.change(input, { target: { value: "pri" } })
    expect(input.value).toBe("pri")
    fireEvent.blur(input)
    expect(input.value).toBe("")
    expect(onQueryChange).toHaveBeenLastCalledWith("")
    expect(screen.getByRole("button", { name: "Clear Alex Chen" })).toBeTruthy()
    fireEvent.change(input, { target: { value: "bo" } })
    fireEvent.keyDown(input, { key: "Tab" })
    expect(input.value).toBe("")
  })

  it("does not open on programmatic focus", () => {
    render(<Single />)
    const input = screen.getByRole("combobox") as HTMLInputElement
    input.focus()
    expect(input.getAttribute("aria-expanded")).toBe("false")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(input.getAttribute("aria-expanded")).toBe("true")
  })

  it("does not reopen after clearing the selection", () => {
    render(<SearchableDropdown options={options} placeholder="Search members" value="alex" onValueChange={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Clear Alex Chen" }))
    expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe("false")
  })

  it("exposes the selected value and only points at the list while open", () => {
    render(<SearchableDropdown options={options} placeholder="Search members" value="alex" onValueChange={vi.fn()} />)
    const input = screen.getByRole("combobox")
    const describedBy = input.getAttribute("aria-describedby") ?? ""
    const text = describedBy.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ")
    expect(text).toContain("Selected: Alex Chen")
    expect(input.getAttribute("aria-controls")).toBeNull()
    fireEvent.click(input)
    expect(input.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id)
  })

  it("leaves hidden values out of a disabled field", () => {
    render(<SearchableDropdown options={options} placeholder="Search members" value="alex" onValueChange={vi.fn()} name="judge" disabled />)
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="judge"]')?.disabled).toBe(true)
  })

  it("clears the removal announcement so a repeat is announced again", () => {
    vi.useFakeTimers()
    try {
      render(<Multiple />)
      fireEvent.click(screen.getByRole("button", { name: "Remove Alex Chen" }))
      expect(screen.getByRole("status").textContent).toContain("Alex Chen removed")
      act(() => { vi.advanceTimersByTime(2000) })
      expect(screen.getByRole("status").textContent).not.toContain("removed")
    } finally {
      vi.useRealTimers()
    }
  })
})
