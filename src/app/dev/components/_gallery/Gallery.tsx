"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Menu } from "lucide-react";

import { CopyCode } from "@/components/shared/CopyCode";
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

import { sections } from "../_sections";
import {
  GALLERY_GROUPS,
  type GalleryGroup,
  type GalleryParams,
  type GallerySection,
} from "./types";

type Patch = Partial<GalleryParams>;

/** Side by side needs room for the sidebar and two columns. */
const WIDE_QUERY = "(min-width: 1280px)";

const GROUP_BLURBS: Record<GalleryGroup, string> = {
  Foundations: "The tokens everything else is built from.",
  Actions: "Things people press.",
  Forms: "Fields and controls for entering and choosing.",
  Overlays: "Content that opens above the page.",
  Navigation: "Moving between pages and within one.",
  "Data display": "Showing records, people, events and status.",
  Feedback: "Telling people what happened, or that nothing is there.",
  Composites: "Shared assemblies of the primitives.",
  Templates: "Whole pages on fixture data.",
};

/** Sections grouped in sidebar order; a group with no sections is dropped. */
const GROUPED = GALLERY_GROUPS.map((group) => ({
  group,
  items: sections.filter((s) => s.group === group),
})).filter((g) => g.items.length > 0);

/** Sidebar order, for previous and next. */
const ORDERED = GROUPED.flatMap((g) => g.items);

/** Build a gallery URL from the current params plus a change, dropping defaults. */
function href(current: GalleryParams, patch: Patch) {
  const next = { ...current, ...patch };
  const query = new URLSearchParams();
  if (next.theme) query.set("theme", next.theme);
  if (next.density !== "comfortable") query.set("density", next.density);
  if (next.section) query.set("section", next.section);
  if (next.open) query.set("open", next.open);
  const search = query.toString();
  return search ? `/dev/components?${search}` : "/dev/components";
}

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

function matches(section: GallerySection, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    section.title,
    section.id,
    section.group,
    section.description,
    ...(section.importNames ?? []),
  ].some((text) => text.toLowerCase().includes(needle));
}

/**
 * The gallery shell: a docs-style sidebar (a sheet on phones), one section per
 * page, theme and density handling. Sections only render components; every
 * query parameter is interpreted here.
 */
export function Gallery(params: GalleryParams) {
  const { theme, density, section, open } = params;
  const current = section ? sections.find((s) => s.id === section) : undefined;
  const wide = useWide();
  const user = useUserTheme();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Bring the specimen that `?open=` forces open into view; specimens name
  // their state in the caption, e.g. "Menu (?open=select)".
  useEffect(() => {
    if (!open) return;
    document
      .querySelector(`[data-specimen*="?open=${open})"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open]);

  const navigator = (
    <Navigator
      params={params}
      query={query}
      onQueryChange={setQuery}
      wide={wide}
      shownTheme={shownTheme}
      onNavigate={() => setMenuOpen(false)}
    />
  );

  return (
    <div className="min-h-dvh bg-background text-foreground md:flex">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-border-subtle bg-section md:flex">
        <Link
          href={href(params, { section: undefined, open: undefined })}
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
            {current ? (
              <span className="truncate text-badge text-muted-foreground">
                {current.group}
              </span>
            ) : null}
            <span className="truncate text-body-medium">
              {current?.title ?? (section ? "Not found" : "Overview")}
            </span>
          </div>
        </header>

        <div
          data-density={density === "compact" ? "compact" : undefined}
          className="flex"
        >
          <main
            ref={contentRef}
            className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-8 md:pt-10 lg:px-12"
          >
            <div className={cn("mx-auto", split ? "max-w-[1600px]" : "max-w-[1200px]")}>
              {!section ? (
                <Overview params={params} />
              ) : current ? (
                <SectionPage
                  key={`${current.id}:${theme ?? ""}:${density}:${open ?? ""}:${split}`}
                  section={current}
                  params={params}
                  split={split}
                />
              ) : (
                <NotFound params={params} section={section} />
              )}
            </div>
          </main>

          {current ? (
            <aside
              aria-label="On this page"
              className={cn("hidden w-56 shrink-0", split ? "2xl:block" : "xl:block")}
            >
              <OnThisPage
                rootRef={contentRef}
                watchKey={`${current.id}:${split}:${open ?? ""}`}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- Navigation -------------------------------------------------------------

function Navigator({
  params,
  query,
  onQueryChange,
  wide,
  shownTheme,
  onNavigate,
}: {
  params: GalleryParams;
  query: string;
  onQueryChange: (query: string) => void;
  wide: boolean;
  shownTheme: Theme;
  onNavigate: () => void;
}) {
  const filtered = GROUPED.map((g) => ({
    group: g.group,
    items: g.items.filter((s) => matches(s, query)),
  })).filter((g) => g.items.length > 0);
  const count = filtered.reduce((sum, g) => sum + g.items.length, 0);
  const navRef = useRef<HTMLElement>(null);

  // Keep the current entry in view when a section deep in the list opens.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [params.section]);

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
        <ul className="flex flex-col gap-0.5 pt-1">
          <NavItem
            href={href(params, { section: undefined, open: undefined })}
            active={!params.section}
            onNavigate={onNavigate}
          >
            Overview
          </NavItem>
        </ul>

        {filtered.map(({ group, items }) => (
          <div key={group} className="pt-4">
            <h2 className="px-3 pb-1 text-label font-semibold text-foreground">{group}</h2>
            <ul className="flex flex-col gap-0.5">
              {items.map((s) => (
                <NavItem
                  key={s.id}
                  href={href(params, { section: s.id, open: undefined })}
                  active={params.section === s.id}
                  onNavigate={onNavigate}
                >
                  {s.title}
                </NavItem>
              ))}
            </ul>
          </div>
        ))}

        {count === 0 ? (
          <p className="px-3 pt-4 text-small text-muted-foreground">
            No components match “{query.trim()}”.
          </p>
        ) : null}
      </nav>

      <div className="border-t border-border-subtle p-4">
        <DisplayControls params={params} wide={wide} shownTheme={shownTheme} />
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
  params,
  wide,
  shownTheme,
}: {
  params: GalleryParams;
  wide: boolean;
  shownTheme: Theme;
}) {
  const router = useRouter();
  const go = (patch: Patch) => router.push(href(params, patch), { scroll: false });
  const themeValue = params.theme === "split" && wide ? "split" : shownTheme;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-muted-foreground">Theme</span>
        <SegmentedToggle
          aria-label="Theme"
          value={themeValue}
          onValueChange={(value) => go({ theme: value as GalleryParams["theme"] })}
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
            go({ density: value as GalleryParams["density"] })
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

// --- Pages ------------------------------------------------------------------

function Overview({ params }: { params: GalleryParams }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">UX Hub components</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Every shared component in its variants and states, rendered on
          fixture data: nothing is fetched and nothing needs a sign-in. Pick a
          section below or from the menu, and switch theme and density to
          check each one.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {GROUPED.map(({ group, items }) => (
          <section
            key={group}
            aria-labelledby={`group-${group}`}
            className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-card p-5"
          >
            <div className="flex flex-col gap-0.5">
              <h2 id={`group-${group}`} className="text-subheading">
                {group}
              </h2>
              <p className="text-small text-muted-foreground">
                {GROUP_BLURBS[group]}
              </p>
            </div>
            <ul className="-mx-2 flex flex-col gap-0.5">
              {items.map((s) => (
                <li key={s.id}>
                  <Link
                    href={href(params, { section: s.id, open: undefined })}
                    className="flex flex-col rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-accent focus-visible:focus-ring"
                  >
                    <span className="text-body-medium text-primary">{s.title}</span>
                    <span className="text-small text-muted-foreground">
                      {s.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function NotFound({ params, section }: { params: GalleryParams; section: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-h1">Not found</h1>
      <p className="text-body text-muted-foreground">
        No section called “{section}”.{" "}
        <Link
          href={href(params, { section: undefined, open: undefined })}
          className="text-primary underline underline-offset-4"
        >
          See every section
        </Link>
        .
      </p>
    </div>
  );
}

function SectionPage({
  section,
  params,
  split: splitView,
}: {
  section: GallerySection;
  params: GalleryParams;
  split: boolean;
}) {
  const { id, title, group, description, spec, layout, openStates, Component } =
    section;
  const { open } = params;
  const forcesOpen = Boolean(open && openStates?.includes(open));
  const split = splitView && layout === "split" && !forcesOpen;
  const index = ORDERED.findIndex((s) => s.id === id);
  const previous = index > 0 ? ORDERED[index - 1] : undefined;
  const next = ORDERED[index + 1];
  const importLine = section.importPath
    ? `import { ${(section.importNames ?? []).join(", ")} } from "${section.importPath}";`
    : undefined;

  return (
    <article id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-3 border-b border-border-subtle pb-6">
        <p className="text-label text-muted-foreground">{group}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 id={`${id}-heading`} className="text-h1">
            {title}
          </h1>
          <span className="text-small text-muted-foreground">
            Design system {spec}
          </span>
        </div>
        <p className="max-w-prose text-body text-muted-foreground">{description}</p>

        {importLine ? (
          <CopyCode code={importLine} label="Copy import line" />
        ) : null}

        {openStates?.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-label text-muted-foreground">Force open</span>
            <Chip active={!open} href={href(params, { open: undefined })}>
              None
            </Chip>
            {openStates.map((state) => (
              <Chip
                key={state}
                active={open === state}
                href={href(params, { open: state })}
              >
                {state}
              </Chip>
            ))}
          </div>
        ) : null}

        {splitView && !split ? (
          <p className="text-label text-muted-foreground">
            Shown once, in light: this {forcesOpen ? "state" : "section"} portals
            or fills the page, so check dark with the Dark theme.
          </p>
        ) : null}
      </header>

      {split ? (
        <div className="grid items-stretch gap-6 grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <ThemeColumn key={mode} mode={mode}>
              <Component open={open} />
            </ThemeColumn>
          ))}
        </div>
      ) : (
        // A section that opens on a composition would draw its top rule right
        // under the header's.
        <div className="min-w-0 [&>div>[data-composition]:first-child]:border-t-0 [&>div>[data-composition]:first-child]:pt-0">
          <Component open={open} />
        </div>
      )}

      <nav
        aria-label="Previous and next sections"
        className="mt-8 grid gap-3 border-t border-border-subtle pt-6 sm:grid-cols-2"
      >
        <PagerLink
          direction="previous"
          href={href(params, { section: previous?.id, open: undefined })}
          title={previous?.title ?? "Overview"}
        />
        {next ? (
          <PagerLink
            direction="next"
            href={href(params, { section: next.id, open: undefined })}
            title={next.title}
          />
        ) : null}
      </nav>
    </article>
  );
}

function PagerLink({
  direction,
  href,
  title,
}: {
  direction: "previous" | "next";
  href: string;
  title: string;
}) {
  const isNext = direction === "next";
  return (
    <Link
      href={href}
      rel={isNext ? "next" : "prev"}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-xl border border-border-subtle bg-card px-4 py-3 transition-colors duration-150 hover:bg-accent focus-visible:focus-ring",
        isNext && "items-end text-right sm:col-start-2",
      )}
    >
      <span className="flex items-center gap-1 text-label text-muted-foreground">
        {isNext ? null : <ArrowLeft aria-hidden className="size-3.5" />}
        {isNext ? "Next" : "Previous"}
        {isNext ? <ArrowRight aria-hidden className="size-3.5" /> : null}
      </span>
      <span className="max-w-full truncate text-body-medium text-primary">{title}</span>
    </Link>
  );
}

function Chip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-label transition-colors duration-150 focus-visible:focus-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </Link>
  );
}

function ThemeColumn({
  mode,
  children,
}: {
  mode: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <div
      data-theme={mode}
      data-column={mode}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-background p-6 text-foreground"
    >
      <span className="text-label text-muted-foreground">
        {mode === "light" ? "Light" : "Dark"}
      </span>
      {children}
    </div>
  );
}

// --- On this page -----------------------------------------------------------

/** Specimen group and composition headings, from the light column when split. */
function headings(root: HTMLElement) {
  const scope = root.querySelector<HTMLElement>('[data-column="light"]') ?? root;
  return Array.from(
    scope.querySelectorAll<HTMLElement>("[data-specimen-group], [data-composition]"),
  );
}

function OnThisPage({
  rootRef,
  watchKey,
}: {
  rootRef: RefObject<HTMLElement | null>;
  watchKey: string;
}) {
  const [items, setItems] = useState<readonly string[]>([]);

  // Sections render their own headings, so read them from the page and follow
  // later changes (a section that renders some groups after mount).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const next = headings(root).map(
        (el) => el.dataset.specimenGroup ?? el.dataset.composition ?? "",
      );
      setItems((prev) =>
        prev.length === next.length && prev.every((t, i) => t === next[i])
          ? prev
          : next,
      );
    };
    const frame = requestAnimationFrame(read);
    const observer = new MutationObserver(read);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rootRef, watchKey]);

  if (items.length === 0) return null;

  const jump = (index: number) => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    headings(root)[index]?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div className="sticky top-0 flex max-h-dvh flex-col gap-2 overflow-y-auto py-10 pr-6">
      <h2 className="text-label text-muted-foreground">On this page</h2>
      <ul className="flex flex-col gap-0.5 border-l border-border-subtle">
        {items.map((title, index) => (
          <li key={`${index}:${title}`}>
            <button
              type="button"
              onClick={() => jump(index)}
              className="-ml-px w-full border-l border-transparent py-1 pl-3 text-left text-small text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground focus-visible:focus-ring"
            >
              {title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
