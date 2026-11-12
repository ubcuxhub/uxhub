import { describe, expect, it } from "vitest";

import { cameraProblem } from "./QrCameraView";

const domError = (name: string) => Object.assign(new Error(name), { name });

describe("cameraProblem", () => {
  it("blames the connection first, since an http page gets no camera at all", () => {
    expect(cameraProblem("Camera not found.", false)).toBe("insecure");
  });

  it("asks for permission when the camera was refused", () => {
    expect(cameraProblem(domError("NotAllowedError"), true)).toBe("blocked");
    expect(cameraProblem(domError("SecurityError"), true)).toBe("blocked");
  });

  it("reports a missing camera", () => {
    expect(cameraProblem("Camera not found.", true)).toBe("missing");
    expect(cameraProblem(domError("NotFoundError"), true)).toBe("missing");
    expect(cameraProblem(domError("OverconstrainedError"), true)).toBe("missing");
  });

  it("falls back to a general failure, such as another app holding the camera", () => {
    expect(cameraProblem(domError("NotReadableError"), true)).toBe("failed");
    expect(cameraProblem(undefined, true)).toBe("failed");
  });
});
