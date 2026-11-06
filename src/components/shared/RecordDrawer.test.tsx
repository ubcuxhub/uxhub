// @vitest-environment jsdom

import { useState } from "react";
import Link from "next/link";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Input } from "@/components/ui/input";

import {
  RecordDrawerSkeleton,
  RecordField,
  RecordFrame,
  RecordNotFound,
  RecordSection,
  RecordView,
  useRecordFrame,
} from "./RecordDrawer";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
const loadDocument = vi.fn();
let pathname = "/admin/users/1";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/load-document", () => ({ loadDocument: (href: string) => loadDocument(href) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  router.replace.mockReset();
  pathname = "/admin/users/1";
  window.history.replaceState(null, "", "/");
});

function UserRecord({ error, saving, onSave }: { error?: string; saving?: boolean; onSave?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("Jane Smith");
  return (
    <RecordView
      recordHref="/admin/users/1"
      title={name}
      subtitle="User since July 21, 2026"
      status={<span>Innovator</span>}
      actions={<button type="button" onClick={() => setEditing(true)}>Edit user</button>}
      editing={editing}
      dirty={editing && name !== "Jane Smith"}
      saving={saving}
      error={error}
      onCancel={() => { setName("Jane Smith"); setEditing(false); }}
      onSave={onSave}
      details={
        <RecordSection title="Contact">
          <RecordField label="Name" value={name} htmlFor="name" description="As it appears on tickets.">
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </RecordField>
          <RecordField label="Email" value="jane@example.com" />
          <RecordField label="Phone" value={null} />
        </RecordSection>
      }
    />
  );
}

function Frame({ mode, children = <UserRecord /> }: { mode: "intercepted" | "canonical"; children?: React.ReactNode }) {
  return (
    <>
      <Link href="/admin/events">Manage events</Link>
      <Link href="/admin/users/2">Alex Chen</Link>
      <RecordFrame mode={mode} listHref="/admin/users" listLabel="Back to Manage Users">
        {children}
      </RecordFrame>
    </>
  );
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Jane Smit" } });
}

describe("RecordFrame intercepted", () => {
  it("opens a drawer named by the record, focusing the title", async () => {
    render(<Frame mode="intercepted" />);
    const dialog = screen.getByRole("dialog", { name: "Jane Smith" });
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Jane Smith" })));
    expect(within(dialog).getByRole("heading", { name: "Contact", level: 3 })).toBeTruthy();
  });

  it("goes back on close", () => {
    render(<Frame mode="intercepted" />);
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("opens its full page with a document load", () => {
    render(<Frame mode="intercepted" />);
    const link = screen.getByRole("link", { name: "Open as full page" });
    expect(link.getAttribute("href")).toBe("/admin/users/1");
  });

  it("shows the footer only while editing, and hides the header actions then", () => {
    render(<Frame mode="intercepted" />);
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByText("As it appears on tickets.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit user" })).toBeNull();
    // The description is linked to the control.
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("shows an empty value as a dash read as None", () => {
    render(<Frame mode="intercepted" />);
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("saves from the footer and from Enter in a field", () => {
    const onSave = vi.fn();
    render(<Frame mode="intercepted"><UserRecord onSave={onSave} /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByRole("textbox", { name: "Name" }));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("announces a save error and disables Cancel while saving", () => {
    render(<Frame mode="intercepted"><UserRecord error="Couldn't save the phone number." saving /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't save the phone number.");
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Save changes" }).getAttribute("aria-busy")).toBe("true");
  });

  it("asks before closing with unsaved changes", () => {
    render(<Frame mode="intercepted" />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("holds back a link click on the page behind, then replaces with another record after Discard", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame mode="intercepted" />);
    startEditing();
    expect(fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }))).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.replace).toHaveBeenCalledWith("/admin/users/2");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("pushes a page that isn't a record after Discard", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame mode="intercepted" />);
    startEditing();
    fireEvent.click(screen.getByRole("link", { name: "Manage events" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.push).toHaveBeenCalledWith("/admin/events");
  });

  it("asks first, then loads the full page from scratch", () => {
    render(<Frame mode="intercepted" />);
    startEditing();
    fireEvent.click(screen.getByRole("link", { name: "Open as full page" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(loadDocument).toHaveBeenCalledWith("/admin/users/1");
  });

  it("lets links through once the changes are cancelled", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame mode="intercepted" />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }))).toBe(true);
  });
});

describe("RecordFrame canonical", () => {
  it("renders the drawer's chrome as a page: close, collapse and actions in the top bar, an h1 title, no back pill", () => {
    render(<Frame mode="canonical" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link", { name: "Back to Manage Users" })).toBeNull();
    const bar = document.querySelector<HTMLElement>('[data-slot="side-peek-drawer-header"]')!;
    expect(within(bar).getByRole("button", { name: "Close" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Collapse to drawer" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Edit user" })).toBeTruthy();
    expect(within(bar).queryByRole("link", { name: "Open as full page" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Jane Smith", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Contact", level: 2 })).toBeTruthy();
  });

  it("closes to the list, asking first with unsaved changes", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame mode="canonical" />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.push).toHaveBeenCalledWith("/admin/users");
  });

  it("collapses by replacing itself with the list, then opening the record over it", async () => {
    window.history.replaceState(null, "", "/admin/users/1");
    router.replace.mockImplementation((href: string) => window.history.replaceState(null, "", href));
    render(<Frame mode="canonical" />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse to drawer" }));
    expect(router.replace).toHaveBeenCalledWith("/admin/users");
    expect(router.push).not.toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/users/1"));
    expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0]);
  });

  it("doesn't open the drawer if the list never shows", async () => {
    window.history.replaceState(null, "", "/admin/users/1");
    router.replace.mockImplementation(() => window.history.replaceState(null, "", "/admin/events"));
    render(<Frame mode="canonical" />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse to drawer" }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("asks before collapsing with unsaved changes", async () => {
    window.history.replaceState(null, "", "/admin/users/1");
    router.replace.mockImplementation((href: string) => window.history.replaceState(null, "", href));
    render(<Frame mode="canonical" />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Collapse to drawer" }));
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.replace).toHaveBeenCalledWith("/admin/users");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/users/1"));
  });

  it("loads another record's page instead of opening a drawer over this one", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame mode="canonical" />);
    startEditing();
    fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(loadDocument).toHaveBeenCalledWith("/admin/users/2");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("navigates and closes through the frame without asking when clean", () => {
    function Controls() {
      const { navigate, close } = useRecordFrame();
      return (
        <>
          <button type="button" onClick={() => navigate("/admin/users/1/history")}>Go</button>
          <button type="button" onClick={close}>Done</button>
        </>
      );
    }
    render(<Frame mode="canonical"><Controls /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(router.push).toHaveBeenCalledWith("/admin/users/1/history");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(router.push).toHaveBeenLastCalledWith("/admin/users");
  });
});

describe("one surface in both modes", () => {
  function titleClasses(mode: "intercepted" | "canonical") {
    render(<Frame mode={mode} />);
    const classes = [...screen.getByRole("heading", { name: "Jane Smith" }).classList].sort();
    cleanup();
    return classes;
  }

  it("styles the title identically in the drawer and on the page", () => {
    const drawer = titleClasses("intercepted");
    expect(drawer).toContain("text-h2");
    expect(titleClasses("canonical")).toEqual(drawer);
  });

  it("hides expand and collapse below sm, keeping close", () => {
    render(<Frame mode="intercepted" />);
    const expand = screen.getByRole("link", { name: "Open as full page" });
    expect(expand.closest('[data-slot="side-peek-drawer-resize"]')?.classList).toContain("max-sm:hidden");
    expect(screen.getByRole("button", { name: "Close panel (Esc)" }).closest('[data-slot="side-peek-drawer-resize"]')).toBeNull();
    cleanup();
    render(<Frame mode="canonical" />);
    const collapse = screen.getByRole("button", { name: "Collapse to drawer" });
    expect(collapse.closest('[data-slot="side-peek-drawer-resize"]')?.classList).toContain("max-sm:hidden");
    expect(screen.getByRole("button", { name: "Close" }).closest('[data-slot="side-peek-drawer-resize"]')).toBeNull();
  });
});

describe("loading and not found", () => {
  it("keeps the drawer closable while loading", () => {
    render(<Frame mode="intercepted"><RecordDrawerSkeleton /></Frame>);
    expect(screen.getByRole("dialog", { name: "Loading record" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Loading record");
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("names a missing record in the drawer and on the page", () => {
    render(<Frame mode="intercepted"><RecordNotFound noun="user" /></Frame>);
    expect(screen.getByRole("dialog", { name: "User not found" })).toBeTruthy();
    cleanup();
    render(<Frame mode="canonical"><RecordNotFound noun="event" /></Frame>);
    expect(screen.getByRole("heading", { name: "Event not found", level: 1 })).toBeTruthy();
    // The page keeps its close, with nothing to collapse into.
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Collapse to drawer" })).toBeNull();
  });

  it("refuses record parts outside a frame", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RecordNotFound noun="user" />)).toThrow("inside RecordFrame");
    error.mockRestore();
  });
});
