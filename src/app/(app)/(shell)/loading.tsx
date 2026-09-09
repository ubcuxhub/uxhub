import { Spinner } from "@/components/ui/spinner";

// Streaming boundary for every sidebar-backed portal and admin page. Without
// one the router holds the previous page on screen until the whole RSC payload
// arrives, so a slow route reads as an unresponsive one. (shell)/layout.tsx is
// synchronous, so the sidebar paints immediately and only this fills the
// content area.
//
// It also gives Link prefetch a route shell to cache: with no boundary in the
// tree, prefetching a dynamic route stores nothing.
export default function ShellLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner size="lg" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
