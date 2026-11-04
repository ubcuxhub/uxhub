"use client"

import * as React from "react"

/** Tracks the first visible section in document order. */
export function useCurrentSection(ids: readonly string[], options?: { rootMargin?: string }): string {
  const idsKey = ids.join("\u0000")
  const rootMargin = options?.rootMargin ?? "-10% 0px -65% 0px"
  const [currentId, setCurrentId] = React.useState(ids[0] ?? "")

  React.useEffect(() => {
    const orderedIds = idsKey ? idsKey.split("\u0000") : []
    if (!orderedIds.length) return
    if (typeof IntersectionObserver === "undefined") return

    const visible = new Set<string>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id)
        else visible.delete(entry.target.id)
      }
      const first = orderedIds.find((id) => visible.has(id))
      if (first) setCurrentId(first)
    }, { rootMargin })
    for (const id of orderedIds) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [idsKey, rootMargin])

  return ids.includes(currentId) ? currentId : ids[0] ?? ""
}
