import * as React from "react"

import { timestamptzToDatetimeLocal } from "@/lib/date"

export interface PacificNow {
  /** "2026-10-22" */
  date: string
  /** "14:05", to the minute */
  time: string
}

const CHECK_INTERVAL_MS = 15_000

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, CHECK_INTERVAL_MS)
  return () => window.clearInterval(id)
}

// One string at minute precision, so React only re-renders when the minute changes.
function getSnapshot() {
  return timestamptzToDatetimeLocal(new Date().toISOString())
}

function getServerSnapshot() {
  return null
}

/**
 * The current date and time in Vancouver, where events are scheduled, kept up
 * to date while the page is open. Null during the server render, so nothing
 * time-dependent is baked into the HTML.
 */
export function usePacificNow(): PacificNow | null {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!snapshot) return null

  const [date, time] = snapshot.split("T")
  return { date, time }
}
