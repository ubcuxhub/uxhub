import { describe, expect, it } from "vitest";

import {
  DEFAULT_EVENT_COLOUR,
  EVENT_COLOUR_PRESETS,
  contrastRatio,
  eventColourTint,
  featuredCardGradient,
  normalizeHex,
  readableTextOn,
  ticketGradient,
} from "./event-colour";

describe("normalizeHex", () => {
  it.each([
    ["2f8f6b", "#2F8F6B"],
    ["#2F8F6B", "#2F8F6B"],
    ["#abc", "#AABBCC"],
    ["ABC", "#AABBCC"],
    ["  #325dc4 ", "#325DC4"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeHex(input)).toBe(expected);
  });

  it.each(["", "#", "#12", "#1234", "#12345", "#1234567", "#2F8F6BFF", "#GGGGGG", "blue", "##abc"])(
    "rejects %j",
    (input) => {
      expect(normalizeHex(input)).toBeNull();
    },
  );
});

describe("presets", () => {
  it("lists Blue, Orchid and Slate with Blue as the default", () => {
    expect(EVENT_COLOUR_PRESETS.map((preset) => preset.name)).toEqual([
      "Blue",
      "Orchid",
      "Slate",
    ]);
    expect(EVENT_COLOUR_PRESETS.map((preset) => preset.hex)).toEqual([
      "#325DC4",
      "#C983C7",
      "#4A5E8A",
    ]);
    expect(DEFAULT_EVENT_COLOUR).toBe(EVENT_COLOUR_PRESETS[0].hex);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#325DC4", "#325DC4")).toBeCloseTo(1, 5);
  });

  it("is about 18.9 for white on #111111, in either order", () => {
    expect(contrastRatio("#FFFFFF", "#111111")).toBeCloseTo(18.9, 1);
    expect(contrastRatio("#111111", "#FFFFFF")).toBeCloseTo(18.9, 1);
  });

  it("accepts short hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
  });
});

describe("readableTextOn", () => {
  it("picks white on the dark presets and the dark text on pale colours", () => {
    expect(readableTextOn("#325DC4")).toBe("light");
    expect(readableTextOn("#4A5E8A")).toBe("light");
    expect(readableTextOn("#FEF3C7")).toBe("dark");
    expect(readableTextOn("#C983C7")).toBe("dark");
  });
});

describe("eventColourTint", () => {
  it("mixes with white", () => {
    expect(eventColourTint("#000000", 0.5)).toBe("#808080");
    expect(eventColourTint("#325DC4", 0)).toBe("#325DC4");
    expect(eventColourTint("#325DC4", 1)).toBe("#FFFFFF");
  });

  it("defaults to a 45% mix", () => {
    expect(eventColourTint("#000000")).toBe("#737373");
  });
});

describe("gradients", () => {
  it("ticketGradient runs from the tint at the top to the colour at the bottom", () => {
    const gradient = ticketGradient("#325DC4");
    expect(gradient).toBe(
      `linear-gradient(to bottom, ${eventColourTint("#325DC4")}, #325DC4)`,
    );
  });

  it("featuredCardGradient runs at 135° from the colour to the tint", () => {
    const gradient = featuredCardGradient("#C983C7");
    expect(gradient).toBe(
      `linear-gradient(135deg, #C983C7, ${eventColourTint("#C983C7")})`,
    );
  });

  it("normalizes short hex and falls back to Blue for invalid input", () => {
    expect(ticketGradient("#abc")).toContain("#AABBCC");
    expect(featuredCardGradient("nope")).toContain(DEFAULT_EVENT_COLOUR);
  });
});
