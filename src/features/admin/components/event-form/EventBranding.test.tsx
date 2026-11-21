// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventBranding } from "./EventBranding";
import { getInitialFormState } from "./event-form-schema";

vi.mock("@/components/shared/ImageUpload", () => ({
  ImageUpload: ({ label, onFileChange }: { label: string; onFileChange: (file: File | null) => void }) =>
    <button type="button" onClick={() => onFileChange(new File(["image"], `${label}.png`, { type: "image/png" }))}>Pick {label}</button>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("previews selected images before save, clears header mode and releases temporary URLs", () => {
  const createObjectURL = vi.fn().mockReturnValueOnce("blob:icon").mockReturnValueOnce("blob:header");
  const revokeObjectURL = vi.fn();
  const BrowserURL = URL;
  class PreviewURL extends BrowserURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("URL", PreviewURL);
  const onIcon = vi.fn();
  const onHeader = vi.fn();
  const onChange = vi.fn();
  const { container, unmount } = render(<EventBranding state={getInitialFormState()} disabled={false} onIcon={onIcon} onHeader={onHeader} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Pick Icon" }));
  expect(container.querySelector('[aria-label="Header preview"] img')?.getAttribute("src")).toBe("blob:icon");
  expect(onIcon).toHaveBeenCalledWith(expect.any(File));
  fireEvent.click(screen.getByRole("radio", { name: "Image" }));
  fireEvent.click(screen.getByRole("button", { name: "Pick Header image" }));
  expect(container.querySelector('[aria-label="Header preview"] img[src="blob:header"]')).toBeTruthy();
  expect(onHeader).toHaveBeenCalledWith(expect.any(File));
  fireEvent.click(screen.getByRole("radio", { name: "Colour" }));
  expect(container.querySelector('[aria-label="Header preview"] img[src="blob:header"]')).toBeNull();
  expect(onHeader).toHaveBeenLastCalledWith(null);
  expect(onChange).toHaveBeenCalledWith("header_image_url", "");
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:header");
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:icon");
});
