import type { ReactNode } from "react";

/** Full-viewport dark camera surface; caller owns capture, target and permissions. */
export function ScannerFrame({ header, children }: { header: ReactNode; children: ReactNode; }) {
  return <section data-theme="dark" aria-label="Ticket scanner" className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">{header}</header>
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-6 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
  </section>;
}
export function ScannerViewfinder({ children }: { children: ReactNode; }) {
  return <div className="relative mx-auto aspect-square w-[264px] max-w-full overflow-hidden rounded-xl border border-border" data-slot="scanner-viewfinder">{children}</div>;
}
