import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMAIL_ASSET_ORIGIN,
  HUBBO_EMAIL_WIDTH,
  HUBBO_EMOTIONS,
  type HubboEmotion,
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

  it.each(emotions)("renders %s Hubbo with an absolute URL, size and alt", (emotion) => {
    const html = render(emotion);
    const { width, height } = HUBBO_EMOTIONS[emotion];
    const scaledHeight = Math.round((height * HUBBO_EMAIL_WIDTH) / width);
    const img = html.match(/<img [^>]*>/)?.[0] ?? "";

    expect(img).toContain(`src="${EMAIL_ASSET_ORIGIN}/email/hubbo-${emotion}.png"`);
    expect(img).toContain(`width="${HUBBO_EMAIL_WIDTH}"`);
    expect(img).toContain(`height="${scaledHeight}"`);
    expect(img).toContain('alt="Hubbo"');
    expect(img).toContain('border="0"');
    expect(img).toContain("display:block");
    // Above the heading, so it greets the reader first.
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<h1"));
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
