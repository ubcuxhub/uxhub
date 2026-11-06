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
  RecordPageTopBar,
  RecordSection,
  RecordView,
  useRecordFrame,
} from "./RecordDrawer";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/admin/users/1";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  pathname = "/admin/users/1";
  window.history.replaceState(null, "", "/");
});

function UserRecord({ error, saving, onSave }: { error?: string; saving?: boolean; onSave?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("Jane Smith");
  return (
    <RecordView
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

/** The users list layout: the list, and the record route in the frame. */
function Frame({ children = <UserRecord /> }: { children?: React.ReactNode }) {
  return (
    <>
      <Link href="/admin/events">Manage events</Link>
      <Link href="/admin/users/2">Alex Chen</Link>
      <RecordFrame listHref="/admin/users">{pathname === "/admin/users" ? null : children}</RecordFrame>
    </>
  );
}

/** Moves the mocked URL and re-renders the layout, as a soft navigation does. */
function navigateTo(path: string, rerender: (ui: React.ReactElement) => void, children?: React.ReactNode) {
  pathname = path;
  rerender(<Frame>{children}</Frame>);
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Jane Smit" } });
}

describe("RecordFrame", () => {
  it("opens a drawer named by the record, focusing the title", async () => {
    render(<Frame />);
    const dialog = screen.getByRole("dialog", { name: "Jane Smith" });
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Jane Smith" })));
    expect(within(dialog).getByRole("heading", { name: "Contact", level: 3 })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Jane Smith" }).classList).toContain("text-h2");
  });

  it("stays closed on the list itself and under paths deeper than a record", () => {
    pathname = "/admin/users";
    const { rerender } = render(<Frame />);
    expect(screen.queryByRole("dialog")).toBeNull();
    navigateTo("/admin/users/1/history", rerender);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no expand control: a record has no full page", () => {
    render(<Frame />);
    expect(screen.queryByRole("link", { name: "Open as full page" })).toBeNull();
    expect(document.querySelector('[data-slot="side-peek-drawer-resize"]')).toBeNull();
  });

  it("goes back to the list it was opened from, after sliding out", async () => {
    pathname = "/admin/users";
    const { rerender } = render(<Frame />);
    navigateTo("/admin/users/1", rerender);
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(router.back).not.toHaveBeenCalled();
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("still goes back after swapping records, since a row click replaces", async () => {
    pathname = "/admin/users";
    const { rerender } = render(<Frame />);
    navigateTo("/admin/users/1", rerender);
    navigateTo("/admin/users/2", rerender);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it("replaces itself with the list when it wasn't opened from there", async () => {
    // A refresh, a shared link, or the builder's collapse.
    render(<Frame />);
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/users"));
    expect(router.back).not.toHaveBeenCalled();
  });

  it("doesn't leave if another record opens while it slides out", async () => {
    pathname = "/admin/users";
    const { rerender } = render(<Frame />);
    navigateTo("/admin/users/1", rerender);
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    navigateTo("/admin/users/2", rerender);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Jane Smith" })).toBeTruthy();
  });

  it("closes without sliding out when the URL leaves the record (browser Back)", () => {
    pathname = "/admin/users";
    const { rerender } = render(<Frame />);
    navigateTo("/admin/users/1", rerender);
    navigateTo("/admin/users", rerender);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("shows the footer only while editing, and hides the header actions then", () => {
    render(<Frame />);
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
    render(<Frame />);
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("saves from the footer and from Enter in a field", () => {
    const onSave = vi.fn();
    render(<Frame><UserRecord onSave={onSave} /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByRole("textbox", { name: "Name" }));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("announces a save error and disables Cancel while saving", () => {
    render(<Frame><UserRecord error="Couldn't save the phone number." saving /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't save the phone number.");
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Save changes" }).getAttribute("aria-busy")).toBe("true");
  });

  it("asks before closing with unsaved changes", async () => {
    render(<Frame />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/users"));
  });

  it("holds back a link click on the page behind, then replaces with another record after Discard", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame />);
    startEditing();
    expect(fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }))).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.replace).toHaveBeenCalledWith("/admin/users/2");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("pushes a page that isn't a record after Discard", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame />);
    startEditing();
    fireEvent.click(screen.getByRole("link", { name: "Manage events" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(router.push).toHaveBeenCalledWith("/admin/events");
  });

  it("lets links through once the changes are cancelled", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    render(<Frame />);
    startEditing();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }))).toBe(true);
  });

  it("navigates and closes through the frame without asking when clean", async () => {
    function Controls() {
      const { navigate, close } = useRecordFrame();
      return (
        <>
          <button type="button" onClick={() => navigate("/admin/users/1/history")}>Go</button>
          <button type="button" onClick={() => navigate("/admin/users/3")}>Next</button>
          <button type="button" onClick={close}>Done</button>
        </>
      );
    }
    render(<Frame><Controls /></Frame>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(router.push).toHaveBeenCalledWith("/admin/users/1/history");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(router.replace).toHaveBeenCalledWith("/admin/users/3");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(router.replace).toHaveBeenLastCalledWith("/admin/users"));
  });

  it("follows an open prop and onClose instead of the URL (demos)", () => {
    const onClose = vi.fn();
    pathname = "/dev/components/record-drawer";
    const { rerender } = render(
      <RecordFrame listHref="/dev/components/record-drawer" open onClose={onClose}>
        <UserRecord />
      </RecordFrame>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <RecordFrame listHref="/dev/components/record-drawer" open={false} onClose={onClose}>
        <UserRecord />
      </RecordFrame>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("RecordPageTopBar", () => {
  it("closes to the list and collapses to the record's drawer, both as links", () => {
    render(<RecordPageTopBar listHref="/admin/events" listLabel="Back to Manage Events" recordHref="/admin/events/1" />);
    expect(screen.getByRole("link", { name: "Close" }).getAttribute("href")).toBe("/admin/events");
    const collapse = screen.getByRole("link", { name: "Collapse to drawer" });
    expect(collapse.getAttribute("href")).toBe("/admin/events/1");
    // Collapse is hidden below sm, as expand is in the drawer; close stays.
    expect(collapse.closest('[data-slot="side-peek-drawer-resize"]')?.classList).toContain("max-sm:hidden");
    expect(screen.getByRole("link", { name: "Close" }).closest('[data-slot="side-peek-drawer-resize"]')).toBeNull();
  });
});

describe("loading and not found", () => {
  it("keeps the drawer closable while loading", async () => {
    render(<Frame><RecordDrawerSkeleton /></Frame>);
    expect(screen.getByRole("dialog", { name: "Loading record" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Loading record");
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/users"));
  });

  it("names a missing record in the drawer", () => {
    render(<Frame><RecordNotFound noun="user" /></Frame>);
    expect(screen.getByRole("dialog", { name: "User not found" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close panel (Esc)" })).toBeTruthy();
  });

  it("refuses record parts outside a frame", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<UserRecord />)).toThrow("inside RecordFrame");
    error.mockRestore();
  });
});
