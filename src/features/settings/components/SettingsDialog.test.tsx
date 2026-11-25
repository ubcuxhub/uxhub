// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/portal/events/uxathon/apply",
}));

// The tabs stand in as buttons: the dialog only cares that a profile save
// reports back, and when.
const profile = vi.hoisted(() => ({ onSaved: undefined as (() => void) | undefined }));
vi.mock("./ProfileSettings", () => ({
  ProfileSettings: ({ onSaved }: { onSaved?: () => void }) => {
    profile.onSaved = onSaved;
    return (
      <button type="button" onClick={() => onSaved?.()}>
        Fake save
      </button>
    );
  },
}));
vi.mock("./GeneralSettings", () => ({ GeneralSettings: () => <p>General tab</p> }));
vi.mock("./PurchaseHistorySettings", () => ({ PurchaseHistorySettings: () => null }));

import { SettingsDialog } from "./SettingsDialog";

/** Opens on a tab the way `openSettings` does, and as a deep link would. */
function openAt(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

const close = () => fireEvent.click(screen.getByRole("button", { name: "Close" }));

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  window.history.replaceState(null, "", "/portal/events/uxathon/apply");
  profile.onSaved = undefined;
  refresh.mockClear();
  // jsdom would navigate for real, later and into the next test.
  vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SettingsDialog refresh after a profile edit", () => {
  it("refreshes the page behind once it closes after a save, not while open", () => {
    render(<SettingsDialog />);
    openAt("#settings/profile");

    fireEvent.click(screen.getByRole("button", { name: "Fake save" }));
    fireEvent.click(screen.getByRole("button", { name: "Fake save" }));
    expect(refresh).not.toHaveBeenCalled();

    close();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't refresh when it closes with nothing saved", () => {
    render(<SettingsDialog />);
    openAt("#settings/profile");
    close();
    expect(refresh).not.toHaveBeenCalled();

    // Nor on a later close: the earlier save was already refreshed for.
    openAt("#settings/profile");
    fireEvent.click(screen.getByRole("button", { name: "Fake save" }));
    close();
    openAt("#settings/general");
    close();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when Back (a hash change) closes it after a save", () => {
    render(<SettingsDialog />);
    openAt("#settings/profile");
    fireEvent.click(screen.getByRole("button", { name: "Fake save" }));
    openAt("");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes for a save that lands after it closed", () => {
    render(<SettingsDialog />);
    openAt("#settings/profile");
    // The profile flushes a pending change as it unmounts; that save
    // finishes after the dialog is gone.
    const onSaved = profile.onSaved!;
    close();
    expect(refresh).not.toHaveBeenCalled();

    act(() => onSaved());
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsDialog history on close", () => {
  it("goes back over the entry that opening it pushed, so Back then leaves the page", () => {
    render(<SettingsDialog />);
    openAt("#settings/general");
    const replace = vi.spyOn(window.history, "replaceState");
    close();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps going back after a tab switch, which replaces rather than pushes", () => {
    render(<SettingsDialog />);
    openAt("#settings/general");
    fireEvent.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    close();
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it("strips the hash in place when it was open on load, with nothing of ours to go back over", () => {
    window.history.replaceState(null, "", "/portal#settings/general");
    render(<SettingsDialog />);
    close();
    expect(window.history.back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("doesn't go back again once Back already closed it", () => {
    render(<SettingsDialog />);
    openAt("#settings/general");
    openAt("");
    openAt("#settings/general");
    close();
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });
});
