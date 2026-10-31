// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageUpload } from "./ImageUpload";

afterEach(cleanup);

const noop = () => {};

/** The group is labelled too, so ask for the input specifically. */
const input = (name = "Image cover for the event") =>
  screen.getByLabelText<HTMLInputElement>(name, { selector: "input" });

function file(name: string, type: string) {
  return new File(["x"], name, { type });
}

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

  it("builds the requirements line from props", () => {
    const { rerender } = render(<ImageUpload onChange={noop} />);
    expect(screen.getByText(/Square JPG or PNG, up to 4 MB/)).toBeTruthy();

    rerender(
      <ImageUpload
        onChange={noop}
        requirements={{ minWidth: 1600, minHeight: 400 }}
      />,
    );
    expect(
      screen.getByText(/JPG or PNG, 1600 × 400 px or larger, up to 4 MB/),
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
