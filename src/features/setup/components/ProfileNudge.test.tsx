// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dismiss = vi.fn();
const openSettings = vi.fn();
vi.mock("../profile-nudge-actions", () => ({
  dismissProfileNudgeAction: () => dismiss(),
}));
vi.mock("@/features/settings/components/SettingsDialog", () => ({
  openSettings: (tab?: string) => openSettings(tab),
}));

import { ProfileNudge } from "./ProfileNudge";

describe("ProfileNudge", () => {
  afterEach(cleanup);

  beforeEach(() => {
    dismiss.mockClear();
    openSettings.mockClear();
  });

  it("opens Settings > Profile", () => {
    render(<ProfileNudge />);
    fireEvent.click(screen.getByRole("button", { name: "Add interests" }));
    expect(openSettings).toHaveBeenCalledWith("profile");
  });

  it("hides and records the dismissal", () => {
    render(<ProfileNudge />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Complete your profile")).toBeNull();
  });
});
