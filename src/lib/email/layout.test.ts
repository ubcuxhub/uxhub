import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMAIL_ASSET_ORIGIN,
  HUBBO_EMOTIONS,
  type HubboEmotion,
  hubboEmailSize,
  hubboImageUrl,
  renderEmailLayout,
} from "./layout";

const emotions = Object.keys(HUBBO_EMOTIONS) as HubboEmotion[];

function render(hubbo?: HubboEmotion) {
  return renderEmailLayout({ heading: "Heading", intro: "Intro", body: "<p>Body</p>", hubbo });
}

/** A PNG's pixel size, from its IHDR chunk. */
function pngSize(file: Buffer) {
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("renderEmailLayout hubbo option", () => {
  it("leaves Hubbo out by default", () => {
    expect(render()).not.toContain("<img");
  });

  // 140 px tall, each as wide as its art's ratio makes it, under a 200 px cap.
  it.each([
    ["curious", 123, 140],
    ["excited", 99, 140],
    ["proud", 102, 140],
    ["resting", 189, 140],
    ["thinking", 132, 140],
    ["welcoming", 101, 140],
  ] as const)("renders %s Hubbo at %ix%i with an absolute URL and alt", (emotion, width, height) => {
    const html = render(emotion);
    const img = html.match(/<img [^>]*>/)?.[0] ?? "";

    expect(hubboEmailSize(emotion)).toEqual({ width, height });
    expect(img).toContain(`src="${EMAIL_ASSET_ORIGIN}/email/hubbo-${emotion}.png"`);
    expect(img).toContain(`width="${width}"`);
    expect(img).toContain(`height="${height}"`);
    expect(img).toContain(`width:${width}px;height:${height}px;`);
    expect(img).toContain('alt="Hubbo"');
    expect(img).toContain('border="0"');
    expect(img).toContain("display:block");
    // Above the heading, so it greets the reader first.
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<h1"));
  });

  it("declares UTF-8 and a device-width viewport in the head", () => {
    const head = render().match(/<head>[\s\S]*<\/head>/)?.[0] ?? "";

    expect(head).toContain('<meta charset="utf-8">');
    expect(head).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  });

  it("links the production site, which a real inbox can load", () => {
    expect(hubboImageUrl("proud")).toBe("https://www.ubcuxhub.ca/email/hubbo-proud.png");
  });
});

describe("public/email Hubbo art", () => {
  it.each(emotions)("hubbo-%s.png is an unchanged copy of the app's art", (emotion) => {
    const published = readFileSync(join(process.cwd(), "public", "email", `hubbo-${emotion}.png`));
    const source = readFileSync(join(process.cwd(), "src", "assets", "hubbo", `${emotion}.png`));

    expect(published.equals(source)).toBe(true);
    // The layout's width and height attributes are worked out from these.
    expect(pngSize(published)).toEqual(HUBBO_EMOTIONS[emotion]);
  });
});
