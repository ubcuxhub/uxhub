import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AVATAR_PRESET_ART, avatarPresetLabel, photoFileError } from "./avatar";
import { AVATAR_PRESETS } from "./options";

describe("avatar presets", () => {
  it("has art on disk for every preset", () => {
    for (const preset of AVATAR_PRESETS) {
      const file = path.join("public", AVATAR_PRESET_ART[preset.id]);
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("labels presets", () => {
    expect(avatarPresetLabel("starburst")).toBe("Pink starburst");
  });
});

describe("photoFileError", () => {
  it("accepts JPEG and PNG", () => {
    expect(photoFileError({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(photoFileError({ type: "image/png", size: 5_000_000 })).toBeNull();
  });

  it("names the rule for other types, oversized and empty files", () => {
    expect(photoFileError({ type: "image/gif", size: 1000 })).toMatch(/JPG or PNG/);
    expect(photoFileError({ type: "image/heic", size: 1000 })).toMatch(/JPG or PNG/);
    expect(photoFileError({ type: "image/png", size: 21 * 1024 * 1024 })).toMatch(/over 20 MB/);
    expect(photoFileError({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
});
