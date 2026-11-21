import * as React from "react"

const COARSE_POINTER_QUERY = "(pointer: coarse)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(COARSE_POINTER_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(COARSE_POINTER_QUERY).matches
}

function getServerSnapshot() {
  return null
}

/**
 * Whether the main pointer is a finger, as on a phone or tablet. Null during
 * the server render, where it can't be known.
 */
export function useCoarsePointer(): boolean | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
