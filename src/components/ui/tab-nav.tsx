"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

import { tabsTriggerVariants } from "./tabs"

const TabNavContext = React.createContext<string | null>(null)

/** `/a/b/?x=1#y` -> `/a/b`, so a href and a pathname compare like for like. */
function toPath(value: string): string {
  const path = value.split(/[?#]/, 1)[0] ?? ""
  return path.length > 1 ? path.replace(/\/+$/, "") : path
}

function isActive(pathname: string | null, href: string, exact: boolean) {
  if (pathname === null) return false
  const current = toPath(pathname)
  const target = toPath(href)
  if (current === target) return true
  return !exact && current.startsWith(target === "/" ? "/" : `${target}/`)
}

interface TabNavProps extends React.ComponentProps<"nav"> {
  /**
   * The path to match links against. Defaults to `usePathname()`; pass it to
   * pin the active link in the gallery and in tests.
   */
  pathname?: string
}

/**
 * Pages of one object, one route each (Overview, Applications 12, Check-in).
 * It looks like `Tabs`, but it's navigation, not a tablist: a `<nav>` of
 * links, the current one marked `aria-current="page"`. Tab moves between the
 * links; there are no arrow keys and no tab roles.
 *
 * ```tsx
 * <TabNav aria-label="Event pages">
 *   <TabNavLink href={`/admin/events/${id}`} exact>Overview</TabNavLink>
 *   <TabNavLink href={`/admin/events/${id}/review-applications`} count={12}>
 *     Applications
 *   </TabNavLink>
 *   <TabNavLink href={`/admin/events/${id}/check-in`}>Check-in</TabNavLink>
 * </TabNav>
 * ```
 *
 * Give it an `aria-label`, since the links alone don't say what they switch
 * between. Scrolls sideways when the links don't fit (phones).
 */
function TabNav({
  pathname,
  className,
  children,
  ...props
}: TabNavProps) {
  const routerPathname = usePathname()

  return (
    <TabNavContext.Provider value={pathname ?? routerPathname}>
      <nav
        data-slot="tab-nav"
        className={cn("max-w-full min-w-0 self-start", className)}
        {...props}
      >
        <ul
          role="list"
          className="flex max-w-full items-center gap-1 overflow-x-auto scroll-px-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </ul>
      </nav>
    </TabNavContext.Provider>
  )
}

interface TabNavLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "href" | "children"> {
  href: string
  children: React.ReactNode
  /**
   * Active only on this exact path. Without it a link is also active on any
   * path below it (`/events/1` is active on `/events/1/edit`), so give the
   * root page of an object `exact` or it stays active on every sibling.
   */
  exact?: boolean
  /** Shown after the label in secondary text, and read as part of the name. */
  count?: number
}

function TabNavLink({
  href,
  exact = false,
  count,
  className,
  children,
  ...props
}: TabNavLinkProps) {
  const pathname = React.useContext(TabNavContext)
  const active = isActive(pathname, href, exact)
  const ref = React.useRef<HTMLAnchorElement>(null)

  // Keep the current page's link in view when the row overflows. Only the
  // row's own `scrollLeft` moves: `scrollIntoView` would also scroll the
  // window to a TabNav that sits below the fold.
  React.useEffect(() => {
    const link = ref.current
    const row = link?.closest("ul")
    if (!active || !link || !row || row.scrollWidth <= row.clientWidth) return
    const rowBox = row.getBoundingClientRect()
    const linkBox = link.getBoundingClientRect()
    const leftEdge = linkBox.left - rowBox.left
    const rightEdge = linkBox.right - rowBox.right
    if (leftEdge < 0) row.scrollLeft += leftEdge
    else if (rightEdge > 0) row.scrollLeft += rightEdge
  }, [active])

  return (
    <li className="flex shrink-0">
      <Link
        ref={ref}
        data-slot="tab-nav-link"
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(tabsTriggerVariants({ active: "current" }), className)}
        {...props}
      >
        {children}
        {count !== undefined ? (
          <>
            {" "}
            <span
              data-slot="tab-nav-link-count"
              className="ml-1.5 tabular-nums text-muted-foreground"
            >
              {count}
            </span>
          </>
        ) : null}
      </Link>
    </li>
  )
}

export { TabNav, TabNavLink }
export type { TabNavProps, TabNavLinkProps }
