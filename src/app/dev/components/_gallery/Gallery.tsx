"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, type ReactNode } from "react";

import { FLAGS } from "@/lib/flags";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { sections } from "../_sections";
import type { GalleryParams, GallerySection } from "./types";

type Patch = Partial<GalleryParams>;

/** Build a gallery URL from the current params plus a change, dropping defaults. */
function href(current: GalleryParams, patch: Patch) {
  const next = { ...current, ...patch };
  const query = new URLSearchParams();
  if (next.theme !== "split") query.set("theme", next.theme);
  if (next.density !== "comfortable") query.set("density", next.density);
  if (next.section) query.set("section", next.section);
  if (next.open) query.set("open", next.open);
  const search = query.toString();
  return search ? `?${search}` : "?";
}

/** The theme the root layout's init script would pick: stored, else system. */
function userTheme(): Theme {
  if (!FLAGS.darkMode) return "light";
  return (
    getStoredTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

/**
 * The gallery shell: sticky toolbar, theme and density handling, and the
 * section frames. Sections only render components; every query parameter is
 * interpreted here.
 */
export function Gallery(params: GalleryParams) {
  const { theme, density, section, open } = params;
  const visible = section
    ? sections.filter((s) => s.id === section)
    : sections;

  // `light`/`dark` set the page theme; `split` pins the page to light so the
  // left column really is light even if a dark preference is stored. Uses
  // `applyTheme`, never `setTheme`, so the stored preference is untouched, and
  // puts the user's own theme back on the way out.
  useLayoutEffect(() => {
    applyTheme(theme === "dark" ? "dark" : "light");
    return () => applyTheme(userTheme());
  }, [theme]);

  // Bring the specimen that `?open=` forces open into view; specimens name
  // their state in the caption, e.g. "Menu (?open=select)".
  useEffect(() => {
    if (!open) return;
    document
      .querySelector(`[data-specimen*="?open=${open})"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open]);

  const openStates = visible.length === 1 ? visible[0].openStates : undefined;

  return (
    <div
      data-density={density === "compact" ? "compact" : undefined}
      className="min-h-dvh bg-background text-foreground"
    >
      <Toolbar params={params} openStates={openStates} />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-14 px-5 py-10 sm:px-8">
        {visible.length === 0 ? (
          <p className="text-body text-fg-secondary">
            No section called “{section}”. Pick one from the toolbar.
          </p>
        ) : null}

        {visible.map((s) => (
          <SectionFrame
            key={`${s.id}:${theme}:${density}:${open ?? ""}`}
            section={s}
            theme={theme}
            open={open}
          />
        ))}
      </main>
    </div>
  );
}

function Toolbar({
  params,
  openStates,
}: {
  params: GalleryParams;
  openStates?: readonly string[];
}) {
  const { theme, density, section, open } = params;

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-5 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-h3">Component gallery</h1>
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-badge text-fg-secondary">
              dev only
            </span>
          </div>

          <ControlGroup label="Theme">
            {(["split", "light", "dark"] as const).map((value) => (
              <Chip
                key={value}
                active={theme === value}
                href={href(params, { theme: value })}
              >
                {value === "split" ? "Split" : value === "light" ? "Light" : "Dark"}
              </Chip>
            ))}
          </ControlGroup>

          <ControlGroup label="Density">
            {(["comfortable", "compact"] as const).map((value) => (
              <Chip
                key={value}
                active={density === value}
                href={href(params, { density: value })}
              >
                {value === "comfortable" ? "Comfortable" : "Compact"}
              </Chip>
            ))}
          </ControlGroup>
        </div>

        <nav
          aria-label="Sections"
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          <ControlGroup label="Section">
            <Chip active={!section} href={href(params, { section: undefined, open: undefined })}>
              All
            </Chip>
            {sections.map((s) => (
              <Chip
                key={s.id}
                active={section === s.id}
                href={href(params, { section: s.id, open: undefined })}
              >
                {s.title}
              </Chip>
            ))}
          </ControlGroup>

          {openStates?.length ? (
            <ControlGroup label="Open">
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
            </ControlGroup>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-label text-fg-secondary">{label}</span>
      {children}
    </div>
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
          ? "border-action bg-action text-fg-inverse"
          : "border-border bg-background text-foreground hover:bg-surface-hover",
      )}
    >
      {children}
    </Link>
  );
}

function SectionFrame({
  section,
  theme,
  open,
}: {
  section: GallerySection;
  theme: GalleryParams["theme"];
  open?: string;
}) {
  const { id, title, spec, layout, openStates, Component } = section;
  const forcesOpen = Boolean(open && openStates?.includes(open));
  const split = theme === "split" && layout === "split" && !forcesOpen;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-32 flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-subtle pb-3">
        <h2 id={`${id}-heading`} className="text-h2">
          {title}
        </h2>
        <span className="text-small text-fg-secondary">{spec}</span>
        {layout === "page" || forcesOpen ? (
          <span className="ml-auto text-label text-fg-secondary">
            Page theme: {theme === "dark" ? "dark" : "light"}
          </span>
        ) : null}
      </div>

      {split ? (
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <ThemeColumn key={mode} mode={mode}>
              <Component open={open} />
            </ThemeColumn>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-background p-6">
          <Component open={open} />
        </div>
      )}
    </section>
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
      <span className="text-label text-fg-secondary">
        {mode === "light" ? "Light" : "Dark"}
      </span>
      {children}
    </div>
  );
}
