// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShellLayout from "@/app/(app)/(shell)/layout";

const nav = vi.hoisted(() => ({ pathname: "/portal" }));
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sidebar_state" && cookieJar.value !== undefined
        ? { name, value: cookieJar.value }
        : undefined,
  }),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth/user-context", () => ({
  useUser: () => ({ user: { role_access: "admin" } }),
}));
vi.mock("@/lib/auth/roles", () => ({
  hasAdminAccess: () => true,
  hasManagerAccess: () => false,
}));
// The tab bodies fetch data; only the dialog shell matters here.
vi.mock("@/features/settings/components/GeneralSettings", () => ({
  GeneralSettings: () => <p>general body</p>,
}));
vi.mock("@/features/settings/components/ProfileSettings", () => ({
  ProfileSettings: () => <p>profile body</p>,
}));
vi.mock("@/features/settings/components/PurchaseHistorySettings", () => ({
  PurchaseHistorySettings: () => <p>purchases body</p>,
}));

function setViewport(width: number) {
  window.innerWidth = width;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const layout = async () => ShellLayout({ children: <p>page</p> });

async function renderShell() {
  return render(await layout());
}

beforeEach(() => {
  nav.pathname = "/portal";
  cookieJar.value = undefined;
  window.history.replaceState(null, "", "/portal");
});

afterEach(() => {
  cleanup();
  document.cookie = "sidebar_state=; max-age=0; path=/";
});

describe("sidebar links", () => {
  it("marks only the current page with aria-current", async () => {
    setViewport(1024);
    nav.pathname = "/admin/events/abc";
    await renderShell();
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("Manage Events");
  });

  it("keeps the index route from matching its children", async () => {
    setViewport(1024);
    nav.pathname = "/admin/users";
    await renderShell();
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard.getAttribute("aria-current")).toBeNull();
  });
});

describe("mobile menu", () => {
  it("closes when the route changes", async () => {
    setViewport(500);
    const { rerender } = await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Sidebar" })).toBeTruthy();

    nav.pathname = "/portal/events";
    rerender(await layout());
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull();
  });

  it("stays open when the route has not changed", async () => {
    setViewport(500);
    const { rerender } = await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    rerender(await layout());
    expect(screen.getByRole("dialog", { name: "Sidebar" })).toBeTruthy();
  });

  it("returns focus to the open-menu button when it closes", async () => {
    setViewport(500);
    await renderShell();
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("dialog", { name: "Sidebar" }), {
        key: "Escape",
      });
    });
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull();
    // Radix restores focus on a timer after the content unmounts.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("opens Settings from #settings/purchases while the menu is closed", async () => {
    setViewport(500);
    await renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => {
      window.location.hash = "settings/purchases";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("dialog", { name: "Profile & settings" }),
    ).toBeTruthy();
    expect(screen.getByText("purchases body")).toBeTruthy();
  });

  it("closes the menu when its Settings row opens Settings", async () => {
    setViewport(500);
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Profile & settings" }),
    ).toBeTruthy();
  });
});

describe("collapsed state", () => {
  it("starts expanded with no cookie", async () => {
    setViewport(1024);
    await renderShell();
    expect(
      document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"),
    ).toBe("expanded");
  });

  it("starts collapsed when the cookie says so", async () => {
    setViewport(1024);
    cookieJar.value = "false";
    await renderShell();
    expect(
      document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"),
    ).toBe("collapsed");
  });
});
