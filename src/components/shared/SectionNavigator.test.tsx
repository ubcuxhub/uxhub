// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SectionNavigator, type NavigatorSection } from "./SectionNavigator"

const sections: NavigatorSection[] = [
  { id: "basics", title: "Basics", state: "complete", required: true },
  { id: "registration", title: "Registration", state: "attention", issues: 1, required: true },
  { id: "schedule", title: "Schedule", state: "optional", required: false },
  { id: "publishing", title: "Publishing", state: "not-started", required: true },
]

afterEach(cleanup)

describe("SectionNavigator", () => {
  it("counts only required complete sections and names the trigger", () => {
    render(<SectionNavigator title="Event setup" sections={sections} currentId="registration" defaultOpen />)
    expect(screen.getByRole("menu", { name: "Registration, section 2 of 4, 1 issue. 1 of 3 required sections done" })).toBeTruthy()
    const progress = screen.getByRole("progressbar", { name: "Required sections completed" })
    expect(progress.getAttribute("aria-valuenow")).toBe("1")
    expect(progress.getAttribute("aria-valuemax")).toBe("3")
    expect(screen.getByRole("menuitem", { name: /Registration/ }).getAttribute("aria-current")).toBe("step")
    expect(screen.getByRole("img", { name: "Optional" })).toBeTruthy()
  })

  it("calls onNavigate when a menu item is selected", () => {
    const onNavigate = vi.fn()
    render(<SectionNavigator title="Event setup" sections={sections} currentId="basics" onNavigate={onNavigate} defaultOpen />)
    fireEvent.click(screen.getByRole("menuitem", { name: /Publishing/ }))
    expect(onNavigate).toHaveBeenCalledWith("publishing")
  })
})
