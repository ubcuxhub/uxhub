// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { useCurrentSection } from "./use-current-section"

let callback: IntersectionObserverCallback
const observe = vi.fn()
const disconnect = vi.fn()

class MockObserver {
  constructor(received: IntersectionObserverCallback) { callback = received }
  observe = observe
  disconnect = disconnect
}

function Fixture() {
  const current = useCurrentSection(["first", "second", "third"])
  return <><output>{current}</output><section id="first" /><section id="second" /><section id="third" /></>
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe("useCurrentSection", () => {
  it("selects the top-most intersecting section and cleans up", () => {
    vi.stubGlobal("IntersectionObserver", MockObserver)
    const { unmount } = render(<Fixture />)
    expect(observe).toHaveBeenCalledTimes(3)
    act(() => callback([
      { target: document.getElementById("third"), isIntersecting: true },
      { target: document.getElementById("second"), isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver))
    expect(screen.getByRole("status").textContent).toBe("second")
    act(() => callback([{ target: document.getElementById("second"), isIntersecting: false }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver))
    expect(screen.getByRole("status").textContent).toBe("third")
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
