// @vitest-environment jsdom

import Link from "next/link";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "./sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  window.innerWidth = 1024;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  document.cookie = "sidebar_state=; max-age=0; path=/";
});

function renderSidebar(extra?: React.ReactNode) {
  return render(
    <SidebarProvider>
      <Sidebar>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive asChild>
              <Link href="/a">Active</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/b">Idle</Link>
            </SidebarMenuButton>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton isActive asChild>
                  <Link href="/b/c">Child</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>
      </Sidebar>
      {extra}
    </SidebarProvider>,
  );
}

const state = () =>
  document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state");

function pressCtrlB(target: Element = document.body) {
  return fireEvent.keyDown(target, { key: "b", ctrlKey: true });
}

describe("active rows", () => {
  it("expose aria-current only when active", () => {
    renderSidebar();
    expect(screen.getByText("Active").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Idle").getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Child").getAttribute("aria-current")).toBe("page");
  });
});

describe("row hover", () => {
  it("uses a visible surface, not the faint accent token", () => {
    renderSidebar();
    const className = screen.getByText("Idle").className;
    expect(className).toContain("hover:bg-muted");
    expect(className).not.toContain("hover:bg-accent");
  });
});

describe("Ctrl/Cmd+B", () => {
  it("toggles the sidebar and persists the state", () => {
    renderSidebar();
    expect(state()).toBe("expanded");
    pressCtrlB();
    expect(state()).toBe("collapsed");
    expect(document.cookie).toContain("sidebar_state=false");
    fireEvent.keyDown(document.body, { key: "b", metaKey: true });
    expect(state()).toBe("expanded");
  });

  it("is ignored inside a text field", () => {
    renderSidebar(<input aria-label="Name" />);
    pressCtrlB(screen.getByLabelText("Name"));
    expect(state()).toBe("expanded");
  });

  it("is ignored inside a contenteditable region", () => {
    renderSidebar(
      <div contentEditable suppressContentEditableWarning data-testid="editor" />,
    );
    pressCtrlB(screen.getByTestId("editor"));
    expect(state()).toBe("expanded");
  });

  it("is ignored while a modal dialog is open", () => {
    renderSidebar(
      <div role="dialog" data-state="open">
        Settings
      </div>,
    );
    pressCtrlB();
    expect(state()).toBe("expanded");
  });

  it("is ignored once another handler has taken the key", () => {
    renderSidebar();
    const claim = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", claim, { capture: true });
    pressCtrlB();
    window.removeEventListener("keydown", claim, { capture: true });
    expect(state()).toBe("expanded");
  });

  it("toggles one provider, not both, when providers are nested", () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <span>outer</span>
        </Sidebar>
        <SidebarProvider>
          <Sidebar>
            <span>inner</span>
          </Sidebar>
        </SidebarProvider>
      </SidebarProvider>,
    );
    pressCtrlB();
    const states = Array.from(
      document.querySelectorAll('[data-slot="sidebar"]'),
    ).map((el) => el.getAttribute("data-state"));
    expect(states.filter((s) => s === "collapsed")).toHaveLength(1);
  });

  it("ignores Shift and Alt combinations and key repeat", () => {
    renderSidebar();
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true, altKey: true });
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true, repeat: true });
    expect(state()).toBe("expanded");
  });
});
