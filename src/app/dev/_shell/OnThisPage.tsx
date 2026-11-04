"use client";

import { useEffect, useState, type RefObject } from "react";

import { cn } from "@/lib/utils";

/**
 * The page's headings: specimen groups and compositions in a demo, and
 * `data-toc` blocks on pages that are not demos (the index). Read from the
 * light column when split.
 */
function headings(root: HTMLElement) {
  const scope = root.querySelector<HTMLElement>('[data-column="light"]') ?? root;
  return Array.from(
    scope.querySelectorAll<HTMLElement>(
      "[data-specimen-group], [data-composition], [data-toc]",
    ),
  );
}

/** The right rail. Renders nothing when the page has no headings. */
export function OnThisPage({
  rootRef,
  watchKey,
  className,
}: {
  rootRef: RefObject<HTMLElement | null>;
  watchKey: string;
  className?: string;
}) {
  const [items, setItems] = useState<readonly string[]>([]);

  // Pages render their own headings, so read them from the page and follow
  // later changes (a demo that loads, or renders some groups after mount).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const next = headings(root).map(
        (el) =>
          el.dataset.specimenGroup ?? el.dataset.composition ?? el.dataset.toc ?? "",
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
    <aside aria-label="On this page" className={cn("w-56 shrink-0", className)}>
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
    </aside>
  );
}
