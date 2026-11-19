// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const camera = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), destroy: vi.fn(), pause: vi.fn(), decode: vi.fn<(result: { data: string }) => void>() as (result: { data: string }) => void }));
vi.mock("qr-scanner", () => ({
  default: class {
    constructor(_video: unknown, decode: (r: { data: string }) => void) {
      camera.decode = decode;
    }
    start = camera.start; stop = camera.stop; destroy = camera.destroy; pause = camera.pause;
  }
}));
import { QrCameraView } from "./QrCameraView";
beforeEach(() => {
  vi.clearAllMocks();

  camera.start.mockResolvedValue(undefined);

  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});

afterEach(cleanup);
it("provides retry and search when permission is denied, and restarts capture on retry", async () => {
  camera.start.mockRejectedValueOnce({ name: "NotAllowedError" });

  const search = vi.fn();

  render(<QrCameraView paused={false} onScan={vi.fn()} onSearch={search} />);
  await waitFor(() => expect(screen.getByText("Camera access is off")).toBeTruthy());

  fireEvent.click(screen.getByRole("button", { name: "Search attendees" }));

  expect(search).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  await waitFor(() => expect(screen.queryByText("Camera access is off")).toBeNull());

  expect(camera.destroy).toHaveBeenCalled();
});
it("suppresses decoded frames while paused and destroys capture on unmount", async () => {
  const scan = vi.fn();

  const view = render(<QrCameraView paused={false} onScan={scan} />);

  await waitFor(() => expect(camera.start).toHaveBeenCalled());
  act(() => camera.decode({ data: "ticket" }));

  expect(scan).toHaveBeenCalledTimes(1);
  view.rerender(<QrCameraView paused onScan={scan} />);

  act(() => camera.decode({ data: "ticket" }));

  expect(scan).toHaveBeenCalledTimes(1);

  expect(camera.pause).toHaveBeenCalled();

  view.unmount();

  expect(camera.destroy).toHaveBeenCalled();
});

it("ignores a decoded frame delivered after the camera was unmounted", async () => {
  const scan = vi.fn();
  const view = render(<QrCameraView paused={false} onScan={scan}/>);
  await waitFor(() => expect(camera.start).toHaveBeenCalled());
  view.unmount();
  act(() => camera.decode({data:"late-frame"}));
  expect(scan).not.toHaveBeenCalled();
});
