"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Menu } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import {
  SegmentedToggle,
  SegmentedToggleItem,
} from "@/components/ui/segmented-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FLAGS } from "@/lib/flags";
import { applyTheme, getStoredTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { DocsContext } from "./context";
import { filterNav, INDEX_PATH, TOP_LINKS, type NavGroup } from "./nav";
import { OnThisPage } from "./OnThisPage";
import { docsHref, parseDisplayParams, type DisplayParams } from "./params";
import { isCanvasPath } from "./standalone";

type Patch = Partial<DisplayParams>;

/** Side by side needs room for the sidebar and two columns. */
const WIDE_QUERY = "(min-width: 1280px)";

/** The theme the root layout's init script would pick: stored, else system. */
function userTheme(): Theme {
  if (!FLAGS.darkMode) return "light";
  return (
    getStoredTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

function useUserTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, userTheme, () => "light");
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/** What the phone header names: the current page and the group it sits in. */
function currentPage(pathname: string, groups: readonly NavGroup[]) {
  const top = TOP_LINKS.find((link) => link.href === pathname);
  if (top) return { title: top.title };
  for (const group of groups) {
    const entry = group.entries.find((e) => e.href === pathname);
    if (entry) return { group: group.title, title: entry.title };
  }
  return { title: "Not found" };
}

/**
 * The docs shell around every `/dev` page: a sidebar (a sheet on phones),
 * theme, density and Side by side, and the "On this page" rail. Pages render
 * only their content; every query parameter is interpreted here and handed
 * down through `DocsContext`.
 */
export function DocsShell({
  groups,
  children,
}: {
  groups: readonly NavGroup[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = parseDisplayParams(useSearchParams());
  const { theme, density, open } = params;
  const current = currentPage(pathname, groups);
  const wide = useWide();
  const user = useUserTheme();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const canvas = isCanvasPath(pathname);

  // Side by side only exists on wide screens; elsewhere it falls back to its
  // light column.
  const split = theme === "split" && wide;
  const shownTheme: Theme =
    theme === "dark" ? "dark" : theme === "light" || theme === "split" ? "light" : user;

  // `light`/`dark` set the page theme; `split` pins the page to light so the
  // left column really is light even if a dark preference is stored; no
  // `?theme` follows the viewer's own theme. Uses `applyTheme`, never
  // `setTheme`, so the stored preference is untouched. Read live here rather
  // than from `user`, which is "light" during hydration.
  useLayoutEffect(() => {
    applyTheme(theme === "dark" ? "dark" : theme ? "light" : userTheme());
  }, [theme]);

  // Put the viewer's own theme back on the way out.
  useLayoutEffect(() => () => applyTheme(userTheme()), []);

  const navigator = (
    <Navigator
      groups={groups}
      pathname={pathname}
      params={params}
      query={query}
      onQueryChange={setQuery}
      wide={wide}
      shownTheme={shownTheme}
      onNavigate={() => setMenuOpen(false)}
    />
  );

  return (
    <DocsContext value={{ params, split }}>
      <div className="min-h-dvh bg-background text-foreground md:flex">
        <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-border-subtle bg-section md:flex">
          <Link
            href={docsHref(INDEX_PATH, params, { open: undefined })}
            className="mx-5 mt-5 self-start rounded-md text-h3 focus-visible:focus-ring"
          >
            UX Hub components
          </Link>
          <div className="min-h-0 flex-1">{navigator}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border-subtle bg-background px-2 md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <IconButton variant="ghost" label="Open components menu">
                  <Menu aria-hidden />
                </IconButton>
              </SheetTrigger>
              <SheetContent
                side="left"
                aria-describedby={undefined}
                className="w-[min(20rem,88vw)] gap-0 bg-section p-0"
              >
                <SheetHeader className="pb-0">
                  <SheetTitle>UX Hub components</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1">{navigator}</div>
              </SheetContent>
            </Sheet>
            <div className="flex min-w-0 flex-col">
              {current.group ? (
                <span className="truncate text-badge text-muted-foreground">
                  {current.group}
                </span>
              ) : null}
              <span className="truncate text-body-medium">{current.title}</span>
            </div>
          </header>

          {canvas ? (
            // A canvas page fills the window under its own header: no page
            // padding, no width cap and no "On this page" rail. On phones it
            // is ordinary page flow.
            <main
              data-density={density === "compact" ? "compact" : undefined}
              className="flex min-w-0 flex-col md:h-dvh md:overflow-hidden"
            >
              {children}
            </main>
          ) : (
            <div
              data-density={density === "compact" ? "compact" : undefined}
              className="flex"
            >
              <main
                ref={contentRef}
                className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-8 md:pt-10 lg:px-12"
              >
                <div className={cn("mx-auto", split ? "max-w-[1600px]" : "max-w-[1200px]")}>
                  {children}
                </div>
              </main>

              <OnThisPage
                rootRef={contentRef}
                watchKey={`${pathname}:${split}:${open ?? ""}`}
                className={cn("hidden", split ? "2xl:block" : "xl:block")}
              />
            </div>
          )}
        </div>
      </div>
    </DocsContext>
  );
}

// --- Navigation -------------------------------------------------------------

function Navigator({
  groups,
  pathname,
  params,
  query,
  onQueryChange,
  wide,
  shownTheme,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  pathname: string;
  params: DisplayParams;
  query: string;
  onQueryChange: (query: string) => void;
  wide: boolean;
  shownTheme: Theme;
  onNavigate: () => void;
}) {
  const {
    topLinks,
    groups: filtered,
    count,
  } = filterNav(TOP_LINKS, groups, query);
  const navRef = useRef<HTMLElement>(null);
  const link = (href: string) => docsHref(href, params, { open: undefined });

  // Keep the current entry in view when a page deep in the list opens.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 pb-2">
        <SearchField
          label="Search components"
          placeholder="Search"
          value={query}
          onValueChange={onQueryChange}
          resultCount={query.trim() ? count : undefined}
        />
      </div>

      <nav
        ref={navRef}
        aria-label="Components"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        {topLinks.length > 0 ? (
          <ul className="flex flex-col gap-0.5 pt-1">
            {topLinks.map((top) => (
              <NavItem
                key={top.href}
                href={link(top.href)}
                active={pathname === top.href}
                onNavigate={onNavigate}
              >
                {top.title}
              </NavItem>
            ))}
          </ul>
        ) : null}

        {filtered.map((group) => (
          <div key={group.id} className="pt-4">
            <h2 className="px-3 pb-1 text-label font-semibold text-foreground">
              {group.title}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {group.entries.map((entry) => (
                <NavItem
                  key={entry.href}
                  href={link(entry.href)}
                  active={pathname === entry.href}
                  onNavigate={onNavigate}
                >
                  {entry.title}
                </NavItem>
              ))}
            </ul>
          </div>
        ))}

        {count === 0 ? (
          <p className="px-3 pt-4 text-small text-muted-foreground">
            Nothing matches “{query.trim()}”.
          </p>
        ) : null}
      </nav>

      <div className="border-t border-border-subtle p-4">
        <DisplayControls
          pathname={pathname}
          params={params}
          wide={wide}
          shownTheme={shownTheme}
        />
      </div>
    </div>
  );
}

function NavItem({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-9 items-center rounded-lg px-3 py-1.5 text-small transition-colors duration-150 focus-visible:focus-ring",
          active
            ? "bg-secondary font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function DisplayControls({
  pathname,
  params,
  wide,
  shownTheme,
}: {
  pathname: string;
  params: DisplayParams;
  wide: boolean;
  shownTheme: Theme;
}) {
  const router = useRouter();
  const go = (patch: Patch) =>
    router.push(docsHref(pathname, params, patch), { scroll: false });
  const themeValue = params.theme === "split" && wide ? "split" : shownTheme;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-muted-foreground">Theme</span>
        <SegmentedToggle
          aria-label="Theme"
          value={themeValue}
          onValueChange={(value) => go({ theme: value as DisplayParams["theme"] })}
          className="w-full"
        >
          <SegmentedToggleItem value="light">Light</SegmentedToggleItem>
          <SegmentedToggleItem value="dark">Dark</SegmentedToggleItem>
          {wide ? (
            <SegmentedToggleItem value="split">Side by side</SegmentedToggleItem>
          ) : null}
        </SegmentedToggle>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-muted-foreground">Density</span>
        <SegmentedToggle
          aria-label="Density"
          value={params.density}
          onValueChange={(value) =>
            go({ density: value as DisplayParams["density"] })
          }
          className="w-full"
        >
          <SegmentedToggleItem value="comfortable">Comfortable</SegmentedToggleItem>
          <SegmentedToggleItem value="compact">Compact</SegmentedToggleItem>
        </SegmentedToggle>
      </div>
    </div>
  );
}
