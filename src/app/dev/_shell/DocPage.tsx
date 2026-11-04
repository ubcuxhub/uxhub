"use client";

import Link from "next/link";
import {
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";

import {
  ORDERED,
  entryBySlug,
  entryPath,
  groupOf,
} from "@/app/dev/components/_registry";
import { DEMO_LOADERS } from "@/app/dev/components/_registry/demos";
import { CopyCode } from "@/components/shared/CopyCode";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { useDocs } from "./context";
import { INDEX_PATH } from "./nav";
import { STANDALONE, type StandaloneId } from "./standalone";
import type { DemoLoader, DocMeta, SectionProps } from "./types";

const REPO_BLOB = "https://github.com/ubcuxhub/uxhub/blob/main";

const PAGE_LOADERS: Record<StandaloneId, DemoLoader> = {
  foundations: () => import("../foundations/demo"),
  gallery: () => import("../gallery/demo"),
  templates: () => import("../templates/demo"),
};

type Demo = LazyExoticComponent<ComponentType<SectionProps>>;

/**
 * One lazy component per page, keyed by path and made up front so a page
 * renders a stable component. Nothing is fetched until a page renders its
 * own, and this module is only reached from the docs pages: the index and
 * the sidebar never load a demo.
 */
const DEMOS: Record<string, Demo> = Object.fromEntries([
  ...Object.entries(DEMO_LOADERS).map(([slug, load]) => [entryPath(slug), lazy(load)]),
  ...(Object.keys(PAGE_LOADERS) as StandaloneId[]).map((id) => [
    STANDALONE[id].path,
    lazy(PAGE_LOADERS[id]),
  ]),
]);

/**
 * A docs page: header (title, spec, import line, source, `?open=` chips), the
 * demo (in light and dark columns when Side by side), and for components the
 * previous and next pages in sidebar order.
 */
export function DocPage(
  props: { slug: string } | { page: StandaloneId },
) {
  const { params, split: splitView, href } = useDocs();
  const { theme, density, open } = params;

  const entry = "slug" in props ? entryBySlug(props.slug) : undefined;
  const page = "page" in props ? STANDALONE[props.page] : undefined;
  const doc: DocMeta | undefined = entry ?? page;
  if (!doc) return null;

  const path = entry ? entryPath(entry.slug) : page!.path;
  const Demo = DEMOS[path];
  if (!Demo) return null;
  const group = entry ? groupOf(entry) : undefined;
  const { title, description, spec, layout, openStates, source } = doc;
  const forcesOpen = Boolean(open && openStates?.includes(open));
  const split = splitView && layout === "split" && !forcesOpen;
  const importLine = doc.importPath
    ? `import { ${(doc.importNames ?? []).join(", ")} } from "${doc.importPath}";`
    : undefined;

  const index = entry ? ORDERED.indexOf(entry) : -1;
  const previous = index > 0 ? ORDERED[index - 1] : undefined;
  const next = index >= 0 ? ORDERED[index + 1] : undefined;
  const id = path.split("/").pop()!;

  if (layout === "canvas") {
    return (
      <article
        key={`${path}:${theme ?? ""}:${density}`}
        id={id}
        aria-labelledby={`${id}-heading`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* No visible header: the canvas runs edge to edge under the shell. */}
        <h1 id={`${id}-heading`} className="sr-only">
          {title}
        </h1>
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-16">
              <Spinner label="Loading gallery" />
            </div>
          }
        >
          <Demo open={open} />
        </Suspense>
      </article>
    );
  }

  return (
    <article
      // Theme, density, `open` and Side by side each remount the demo, so
      // forced-open states and theme-reading specimens start over.
      key={`${path}:${theme ?? ""}:${density}:${open ?? ""}:${split}`}
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-8"
    >
      <header className="flex min-w-0 flex-col gap-3 border-b border-border-subtle pb-6">
        {group ? (
          <Link
            href={href(`${INDEX_PATH}#${group.id}`, { open: undefined })}
            className="self-start rounded-sm text-label text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:focus-ring"
          >
            {group.title}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 id={`${id}-heading`} className="text-h1">
            {title}
          </h1>
          <span className="text-small text-muted-foreground">
            Design system {spec}
          </span>
        </div>
        <p className="max-w-prose text-body text-muted-foreground">{description}</p>

        {importLine || source ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {importLine ? (
              // A flex item won't shrink below its content without min-w-0,
              // so a long import line would widen the page on phones.
              <div className="min-w-0 max-w-full">
                <CopyCode code={importLine} label="Copy import line" />
              </div>
            ) : null}
            {source ? (
              <Button asChild variant="secondary" size="sm">
                <a href={`${REPO_BLOB}/${source}`} target="_blank" rel="noreferrer">
                  Source
                  <ExternalLink aria-hidden />
                  <span className="sr-only">(opens GitHub in a new tab)</span>
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {openStates?.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-label text-muted-foreground">Force open</span>
            <Chip active={!open} href={href(path, { open: undefined })}>
              None
            </Chip>
            {openStates.map((state) => (
              <Chip
                key={state}
                active={open === state}
                href={href(path, { open: state })}
              >
                {state}
              </Chip>
            ))}
          </div>
        ) : null}

        {splitView && !split ? (
          <p className="text-label text-muted-foreground">
            Shown once, in light: this {forcesOpen ? "state" : "page"} portals
            or fills the page, so check dark with the Dark theme.
          </p>
        ) : null}
      </header>

      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner label="Loading demo" />
          </div>
        }
      >
        {split ? (
          <div className="grid items-stretch gap-6 grid-cols-2">
            {(["light", "dark"] as const).map((mode) => (
              <ThemeColumn key={mode} mode={mode}>
                <Demo open={open} />
              </ThemeColumn>
            ))}
          </div>
        ) : (
          // A demo that opens on a composition would draw its top rule right
          // under the header's.
          <div className="min-w-0 [&>div>[data-composition]:first-child]:border-t-0 [&>div>[data-composition]:first-child]:pt-0">
            <Demo open={open} />
          </div>
        )}
        <ScrollToOpen open={open} />
      </Suspense>

      {entry ? (
        <nav
          aria-label="Previous and next components"
          className="mt-8 grid gap-3 border-t border-border-subtle pt-6 sm:grid-cols-2"
        >
          <PagerLink
            direction="previous"
            href={href(previous ? entryPath(previous.slug) : INDEX_PATH, {
              open: undefined,
            })}
            title={previous?.title ?? "Components"}
          />
          {next ? (
            <PagerLink
              direction="next"
              href={href(entryPath(next.slug), { open: undefined })}
              title={next.title}
            />
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}

/**
 * Brings the specimen that `?open=` forces open into view; specimens name
 * their state in the caption, e.g. "Menu (?open=select)". Rendered after the
 * demo inside its Suspense boundary, so it runs once the demo has loaded.
 */
function ScrollToOpen({ open }: { open?: string }) {
  useEffect(() => {
    if (!open) return;
    document
      .querySelector(`[data-specimen*="?open=${open})"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open]);
  return null;
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
