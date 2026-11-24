// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageUpload } from "./ImageUpload";

const { optimizeEventImage } = vi.hoisted(() => ({ optimizeEventImage: vi.fn() }));
vi.mock("@/lib/event-image-optimize", () => ({ optimizeEventImage }));

afterEach(cleanup);

const noop = () => {};

/** The group is labelled too, so ask for the input specifically. */
const input = (name = "Image cover for the event") =>
  screen.getByLabelText<HTMLInputElement>(name, { selector: "input" });

function file(name: string, type: string, size = 1) {
  return new File([new Uint8Array(size)], name, { type });
}

const MB = 1024 * 1024;

describe("ImageUpload", () => {
  it("points the label at the file input", () => {
    render(<ImageUpload id="cover" label="Header image" onChange={noop} />);
    const el = input("Header image");
    expect(el.tagName).toBe("INPUT");
    expect(el.id).toBe("cover");
    expect(el.getAttribute("type")).toBe("file");
  });

  it("gives each instance its own input id by default", () => {
    render(
      <>
        <ImageUpload label="First" onChange={noop} />
        <ImageUpload label="Second" onChange={noop} />
      </>,
    );
    expect(input("First").id).not.toBe(
      input("Second").id,
    );
  });

  it("keeps the input out of the tab order and offers a button instead", () => {
    render(<ImageUpload onChange={noop} />);
    expect(input().tabIndex).toBe(-1);
    const button = screen.getByRole("button", { name: "Upload image" });
    const click = vi.fn();
    input().addEventListener("click", click);
    fireEvent.click(button);
    expect(click).toHaveBeenCalled();
  });

  it("opens the header picker from its named button and states the size guidance", () => {
    render(<ImageUpload presentation="header" label="Header image" requirements={{ minWidth: 1600, minHeight: 400 }} onChange={noop} />);
    const click = vi.fn();
    input("Header image").addEventListener("click", click);
    fireEvent.click(screen.getByRole("button", { name: "Upload header image" }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByText(/1600 × 400 px or larger, up to 20 MB/)).toBeTruthy();
  });

  it("builds the requirements line from props", () => {
    const { rerender } = render(<ImageUpload onChange={noop} />);
    expect(screen.getByText(/Square JPG or PNG, up to 20 MB/)).toBeTruthy();

    rerender(
      <ImageUpload
        onChange={noop}
        requirements={{ minWidth: 1600, minHeight: 400 }}
      />,
    );
    expect(
      screen.getByText(/JPG or PNG, 1600 × 400 px or larger, up to 20 MB/),
    ).toBeTruthy();

    rerender(<ImageUpload onChange={noop} hint="Drop a banner." />);
    expect(screen.getByText("Drop a banner.")).toBeTruthy();
  });

  it("rejects a GIF with a message that names it", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    fireEvent.change(input(), {
      target: { files: [file("party.gif", "image/gif")] },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That file is a GIF. Upload a JPG or PNG.");
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("shows an external error in place of the hint", () => {
    render(<ImageUpload onChange={noop} error="Couldn’t upload the image." />);
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn’t upload the image.",
    );
    expect(screen.queryByText(/Or drag one here/)).toBeNull();
  });

  it("renders a progressbar and calls onCancelUpload", () => {
    const onCancelUpload = vi.fn();
    render(
      <ImageUpload
        onChange={noop}
        uploading
        progress={64}
        fileName="header.jpg"
        onCancelUpload={onCancelUpload}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("64");
    expect(screen.getByText("header.jpg")).toBeTruthy();
    expect(screen.getByText("64%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(onCancelUpload).toHaveBeenCalledTimes(1);
  });

  it("is indeterminate without progress", () => {
    render(<ImageUpload onChange={noop} uploading />);
    expect(
      screen.getByRole("progressbar").hasAttribute("aria-valuenow"),
    ).toBe(false);
  });

  it("announces progress in 25% steps, then completion", () => {
    const { rerender } = render(
      <ImageUpload onChange={noop} uploading progress={10} />,
    );
    const live = () => screen.getByRole("status").textContent;
    expect(live()).toBe("Uploading 0%");
    rerender(<ImageUpload onChange={noop} uploading progress={64} />);
    expect(live()).toBe("Uploading 50%");
    rerender(<ImageUpload onChange={noop} uploading progress={100} />);
    expect(live()).toBe("Uploading 100%");
    rerender(<ImageUpload onChange={noop} progress={100} value="/a/b.png" />);
    expect(live()).toBe("Upload complete");
  });

  it("announces a cancelled upload", () => {
    const { rerender } = render(
      <ImageUpload
        onChange={noop}
        uploading
        progress={30}
        onCancelUpload={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    rerender(<ImageUpload onChange={noop} progress={30} onCancelUpload={noop} />);
    expect(screen.getByRole("status").textContent).toBe("Upload cancelled");
  });

  it("shows Replace and Remove for an uploaded image, and Remove clears it", () => {
    const onChange = vi.fn();
    const onFileChange = vi.fn();
    render(
      <ImageUpload
        value="https://example.test/covers/design-sprint.png"
        onChange={onChange}
        onFileChange={onFileChange}
      />,
    );
    expect(screen.getByText("design-sprint.png")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onFileChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: "Upload image" })).toBeTruthy();
  });

  it("disables everything when disabled", () => {
    const { rerender } = render(<ImageUpload onChange={noop} disabled />);
    expect(
      (screen.getByRole("button", { name: "Upload image" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      input().disabled,
    ).toBe(true);

    rerender(<ImageUpload onChange={noop} disabled value="/a/b.png" />);
    expect(
      (screen.getByRole("button", { name: "Replace" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove image" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows the dragging state on dragenter and clears it on drop", async () => {
    const { container } = render(<ImageUpload onChange={noop} />);
    const zone = container.querySelector("[data-slot=image-upload]")!;
    fireEvent.dragEnter(zone);
    expect(screen.getByText("Drop to upload")).toBeTruthy();
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    await waitFor(() => expect(screen.queryByText("Drop to upload")).toBeNull());
  });

  it("ignores drags while disabled", () => {
    const { container } = render(<ImageUpload onChange={noop} disabled />);
    fireEvent.dragEnter(container.querySelector("[data-slot=image-upload]")!);
    expect(screen.queryByText("Drop to upload")).toBeNull();
  });
});

/**
 * jsdom never decodes images, so each `<img>` created for a pick waits in
 * `pending` until the test settles it with `decode(index, size)`.
 */
describe("ImageUpload picks", () => {
  type Pending = { image: HTMLImageElement; src: string };
  const pending: Pending[] = [];
  let urlCount = 0;

  beforeEach(() => {
    pending.length = 0;
    urlCount = 0;
    // jsdom has no object URLs; the stubs are removed again in afterEach.
    Object.assign(URL, {
      createObjectURL: () => `blob:test-${urlCount++}`,
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (
      this: HTMLImageElement,
      src: string,
    ) {
      // next/image sets `src` too; only the object URLs are decodes.
      if (src.startsWith("blob:")) pending.push({ image: this, src });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    optimizeEventImage.mockReset();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  function decode(index: number, width: number, height = width) {
    const { image } = pending[index];
    Object.defineProperty(image, "naturalWidth", { value: width });
    Object.defineProperty(image, "naturalHeight", { value: height });
    act(() => image.onload?.(new Event("load")));
  }

  const pick = (f: File) =>
    fireEvent.change(input(), { target: { files: [f] } });

  it.each(["default", "icon", "header"] as const)("previews a valid pick and reports the file in %s presentation", async (presentation) => {
    const onFileChange = vi.fn();
    render(<ImageUpload presentation={presentation} onChange={noop} onFileChange={onFileChange} />);
    const png = file("cover.png", "image/png");
    pick(png);
    decode(0, 400);
    await waitFor(() => expect(onFileChange).toHaveBeenCalledExactlyOnceWith(png));
    await waitFor(() => expect(screen.getByText("cover.png")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe("Image selected");
    await waitFor(() =>
      expect(screen.getByAltText("Event preview").getAttribute("src")).toMatch(
        /^data:image\/png/,
      ),
    );
  });

  it("shrinks a pick over the upload limit and reports the smaller file", async () => {
    const onFileChange = vi.fn();
    const small = file("banner.jpg", "image/jpeg", 2 * MB);
    let finish: (value: File) => void = () => {};
    optimizeEventImage.mockReturnValueOnce(new Promise<File>((resolve) => (finish = resolve)));
    render(<ImageUpload presentation="header" label="Header image" requirements={{ minWidth: 1600, minHeight: 400 }} onChange={noop} onFileChange={onFileChange} />);
    fireEvent.change(input("Header image"), { target: { files: [file("banner.png", "image/png", 9 * MB)] } });
    decode(0, 6000, 1500);

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Optimizing image"));
    expect(screen.getByText("Optimizing…")).toBeTruthy();
    expect(optimizeEventImage).toHaveBeenCalledWith(expect.any(File), { width: 6000, height: 1500 }, { minWidth: 1600, minHeight: 400 });
    expect(onFileChange).not.toHaveBeenCalled();

    await act(async () => finish(small));
    await waitFor(() => expect(onFileChange).toHaveBeenCalledExactlyOnceWith(small));
    expect(screen.getByRole("status").textContent).toBe("Image selected");
  });

  it("says so when a large pick can't be shrunk enough", async () => {
    const onFileChange = vi.fn();
    optimizeEventImage.mockResolvedValueOnce(null);
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    pick(file("huge.png", "image/png", 9 * MB));
    decode(0, 4000);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Couldn’t shrink this image under 4MB/);
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("rejects a file over the source cap without decoding it", async () => {
    render(<ImageUpload onChange={noop} />);
    pick(file("raw.jpg", "image/jpeg", 21 * MB));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Image size must be less than 20MB.");
    expect(pending).toHaveLength(0);
  });

  it("leaves a small pick alone", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    pick(file("icon.png", "image/png"));
    decode(0, 800);
    await waitFor(() => expect(onFileChange).toHaveBeenCalled());
    expect(optimizeEventImage).not.toHaveBeenCalled();
  });

  /** jsdom never decodes images; report the crop dialog's image as loaded. */
  function loadCropImage(width: number, height: number) {
    const image = document.querySelector<HTMLImageElement>("[data-slot=crop-stage] img")!;
    Object.defineProperty(image, "naturalWidth", { value: width });
    Object.defineProperty(image, "naturalHeight", { value: height });
    fireEvent.load(image);
  }

  it("crops a non-square pick to a square before reporting it", async () => {
    const onFileChange = vi.fn();
    const cropped = file("wide.jpg", "image/jpeg", 100);
    optimizeEventImage.mockResolvedValueOnce(cropped);
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    pick(file("wide.png", "image/png"));
    decode(0, 800, 400);

    await screen.findByRole("dialog", { name: "Crop image" });
    expect(onFileChange).not.toHaveBeenCalled();
    loadCropImage(800, 400);
    fireEvent.click(screen.getByRole("button", { name: "Use image" }));

    await waitFor(() => expect(onFileChange).toHaveBeenCalledExactlyOnceWith(cropped));
    expect(optimizeEventImage).toHaveBeenCalledWith(expect.any(File), { width: 800, height: 400 }, {
      minWidth: undefined,
      minHeight: undefined,
      crop: { x: 200, y: 0, width: 400, height: 400 },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The name shows with the preview, which FileReader loads asynchronously.
    expect(await screen.findByText("wide.jpg")).toBeTruthy();
  });

  it("crops a header to 4:1 and keeps it above the minimum", async () => {
    optimizeEventImage.mockResolvedValueOnce(file("banner.jpg", "image/jpeg", 100));
    render(<ImageUpload presentation="header" label="Header image" requirements={{ aspect: 4, minWidth: 1600, minHeight: 400 }} onChange={noop} />);
    fireEvent.change(input("Header image"), { target: { files: [file("banner.jpg", "image/jpeg")] } });
    decode(0, 3000, 2000);
    await screen.findByRole("dialog", { name: "Crop image" });
    loadCropImage(3000, 2000);
    // Zoom is capped where the kept region would drop under 1600 px wide.
    const slider = screen.getByRole("slider", { name: "Zoom" });
    expect(slider.getAttribute("max")).toBe("187");
    fireEvent.click(screen.getByRole("button", { name: "Use image" }));
    await waitFor(() => expect(optimizeEventImage).toHaveBeenCalledOnce());
    expect(optimizeEventImage.mock.calls[0][2].crop).toEqual({ x: 0, y: 625, width: 3000, height: 750 });
  });

  it("skips the crop for a header already close to 4:1", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload presentation="header" label="Header image" requirements={{ aspect: 4, minWidth: 1600, minHeight: 400 }} onChange={noop} onFileChange={onFileChange} />);
    fireEvent.change(input("Header image"), { target: { files: [file("banner.jpg", "image/jpeg")] } });
    decode(0, 1610, 400);
    await waitFor(() => expect(onFileChange).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rejects a pick whose crop would be under the minimum", async () => {
    render(<ImageUpload presentation="header" label="Header image" requirements={{ aspect: 4, minWidth: 1600, minHeight: 400 }} onChange={noop} />);
    fireEvent.change(input("Header image"), { target: { files: [file("tall.jpg", "image/jpeg")] } });
    // Wide enough, but a 4:1 crop of it is only 1500 x 375.
    decode(0, 1500, 2000);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Image must be at least 1600 × 400 px.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("drops the pick when the crop is cancelled", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    pick(file("wide.png", "image/png"));
    decode(0, 800, 400);
    await screen.findByRole("dialog", { name: "Crop image" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onFileChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Upload image" })).toBeTruthy();
  });

  it("lets a later file win when an earlier one finishes decoding last", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload onChange={noop} onFileChange={onFileChange} />);
    const big = file("big.png", "image/png");
    const small = file("small.jpg", "image/jpeg");
    pick(big);
    pick(small);
    expect(pending).toHaveLength(2);

    decode(1, 400);
    await waitFor(() => expect(onFileChange).toHaveBeenCalledWith(small));
    decode(0, 400);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onFileChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("small.jpg")).toBeTruthy();
    expect(screen.queryByText("big.png")).toBeNull();
  });

  it("ignores a stale decode failure after a later valid pick", async () => {
    render(<ImageUpload onChange={noop} />);
    pick(file("old.png", "image/png"));
    pick(file("new.png", "image/png"));
    decode(1, 400);
    await waitFor(() => expect(screen.getByText("new.png")).toBeTruthy());
    act(() => pending[0].image.onerror?.(new Event("error")));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("doesn't bring the image back if it is removed before decoding finishes", async () => {
    const onFileChange = vi.fn();
    render(<ImageUpload onChange={noop} value="/covers/a.png" onFileChange={onFileChange} />);
    pick(file("b.png", "image/png"));
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(onFileChange).toHaveBeenLastCalledWith(null);

    decode(0, 400);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onFileChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText("Event preview")).toBeNull();
  });

  it("ignores a pick that finishes after a new stored value arrives", async () => {
    const onFileChange = vi.fn();
    const { rerender } = render(
      <ImageUpload onChange={noop} value="/covers/a.png" onFileChange={onFileChange} />,
    );
    pick(file("b.png", "image/png"));
    rerender(<ImageUpload onChange={noop} value="/covers/c.png" onFileChange={onFileChange} />);
    decode(0, 400);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onFileChange).not.toHaveBeenCalled();
    expect(screen.getByText("c.png")).toBeTruthy();
  });
});

describe("ImageUpload error wiring", () => {
  it("points the controls at the error that replaces the hint", () => {
    const { rerender } = render(<ImageUpload id="cover" onChange={noop} />);
    const button = () => screen.getByRole("button", { name: "Upload image" });
    expect(button().getAttribute("aria-describedby")).toBe("cover-hint");
    expect(button().hasAttribute("aria-invalid")).toBe(false);

    rerender(<ImageUpload id="cover" onChange={noop} error="Upload failed." />);
    const alert = screen.getByRole("alert");
    expect(alert.id).toBe("cover-error");
    expect(button().getAttribute("aria-describedby")).toBe("cover-error");
    expect(button().getAttribute("aria-invalid")).toBe("true");
    expect(input().getAttribute("aria-describedby")).toBe("cover-error");
  });

  it("does the same for Replace once an image is showing", () => {
    render(<ImageUpload id="cover" onChange={noop} value="/a.png" error="Too big." />);
    const replace = screen.getByRole("button", { name: "Replace" });
    expect(replace.getAttribute("aria-describedby")).toBe("cover-error");
    expect(replace.getAttribute("aria-invalid")).toBe("true");
  });
});

