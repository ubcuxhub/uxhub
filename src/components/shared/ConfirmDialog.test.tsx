// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

function Harness({
  pending = false,
  useReturnRef = false,
}: {
  pending?: boolean;
  useReturnRef?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const other = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete event
      </button>
      <button type="button" ref={other}>
        Elsewhere
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete UXathon?"
        description="This can't be undone."
        cancelLabel="Keep event"
        pending={pending}
        returnFocusRef={useReturnRef ? other : undefined}
        onConfirm={() => {}}
      />
    </>
  );
}

async function openFrom(opener: HTMLElement) {
  opener.focus();
  fireEvent.click(opener);
  await screen.findByRole("dialog", { name: "Delete UXathon?" });
}

describe("ConfirmDialog focus return", () => {
  it("returns focus to the opener when Cancel is pressed", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete event" });
    await openFrom(opener);

    fireEvent.click(screen.getByRole("button", { name: "Keep event" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to the opener on Esc", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete event" });
    await openFrom(opener);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("prefers returnFocusRef over the opener", async () => {
    render(<Harness useReturnRef />);
    await openFrom(screen.getByRole("button", { name: "Delete event" }));

    fireEvent.click(screen.getByRole("button", { name: "Keep event" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" })),
    );
  });
});

describe("ConfirmDialog while pending", () => {
  it("ignores Esc and outside clicks", async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        pending
        onOpenChange={onOpenChange}
        title="Delete UXathon?"
        description="This can't be undone."
        onConfirm={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
