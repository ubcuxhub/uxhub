// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  finishSetupAction: vi.fn(),
  saveSetupAboutAction: vi.fn(),
  saveSetupDietaryAction: vi.fn(),
  saveSetupPhotoAction: vi.fn(),
  skipSetupStepAction: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import { PhotoCropDialog } from "./PhotoCropDialog";

afterEach(cleanup);

/** jsdom never decodes images; report a 1200×800 photo as loaded. */
function loadPhoto() {
  const image = document.querySelector<HTMLImageElement>("[data-slot=crop-stage] img")!;
  Object.defineProperty(image, "naturalWidth", { value: 1200 });
  Object.defineProperty(image, "naturalHeight", { value: 800 });
  fireEvent.load(image);
  return image;
}

function renderDialog() {
  const onCancel = vi.fn();
  const onConfirm = vi.fn(async () => {});
  render(
    <PhotoCropDialog photo={{ url: "blob:photo", name: "me.jpg" }} onCancel={onCancel} onConfirm={onConfirm} />,
  );
  return { onCancel, onConfirm };
}

describe("PhotoCropDialog", () => {
  it("is a titled dialog with a labelled zoom slider", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Crop your photo" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Zoom" }).getAttribute("aria-valuetext")).toBe("100%");
    // Nothing to confirm until the photo has loaded.
    expect(screen.getByRole("button", { name: "Use photo" }).hasAttribute("disabled")).toBe(true);
  });

  it("moves the photo with the arrow keys, inside the crop", () => {
    renderDialog();
    const image = loadPhoto();
    const stage = screen.getByRole("group", { name: "Photo position" });
    expect(stage.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(image.style.left).toBe("51.6%");
    // Vertically the 800px side already fills the crop, so it can't move.
    fireEvent.keyDown(stage, { key: "ArrowDown" });
    expect(image.style.top).toBe("50%");
    // Shift moves further, but never past the photo's edge (a quarter crop).
    for (let i = 0; i < 5; i++) fireEvent.keyDown(stage, { key: "ArrowLeft", shiftKey: true });
    expect(image.style.left).toBe("30%");
  });

  it("zooms with the slider and with + and -", () => {
    renderDialog();
    loadPhoto();
    const slider = screen.getByRole("slider", { name: "Zoom" });
    fireEvent.change(slider, { target: { value: "140" } });
    expect(slider.getAttribute("aria-valuetext")).toBe("140%");
    fireEvent.keyDown(screen.getByRole("group", { name: "Photo position" }), { key: "-" });
    expect(slider.getAttribute("aria-valuetext")).toBe("130%");
  });

  it("cancels without uploading", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("says when the file can't be read", () => {
    renderDialog();
    fireEvent.error(document.querySelector("[data-slot=crop-stage] img")!);
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't be read/);
  });
});
