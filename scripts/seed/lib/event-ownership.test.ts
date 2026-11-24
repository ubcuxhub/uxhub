import { describe, expect, it } from "vitest";

import { buildSeedEvents } from "../data/events.ts";
import {
  describeSkippedEvents,
  planProdEvents,
  type ExistingEventRow,
} from "./event-ownership.ts";

const seeds = buildSeedEvents(new Date("2026-11-23T18:00:00Z"));
const seed = seeds.find((item) => item.event.slug === "portfolio-review-night")!;

/** A prod row exactly as an earlier `--target=prod` run left it. */
function untouched(overrides: Partial<ExistingEventRow> = {}): ExistingEventRow {
  return {
    id: "event-1",
    slug: seed.event.slug,
    status: "draft",
    publish_at: null,
    first_published_at: null,
    canceled_at: null,
    working_document: null,
    name: seed.event.name!,
    short_description: seed.event.short_description ?? null,
    description: seed.event.description ?? null,
    ...overrides,
  };
}

describe("planProdEvents", () => {
  it("creates a seed event no row holds the slug of", () => {
    expect(planProdEvents([seed], [], new Set())).toEqual([
      { slug: seed.event.slug, action: "create" },
    ]);
  });

  it("updates a demo event that still looks as the seed left it", () => {
    expect(planProdEvents([seed], [untouched()], new Set())).toEqual([
      { slug: seed.event.slug, action: "update", id: "event-1" },
    ]);
  });

  it.each([
    ["an admin renamed it", { name: "Portfolio Review Night (in the Nest)" }, /name differ/],
    [
      "an admin rewrote the overview",
      { description: "The real thing, in the Nest." },
      /description differ/,
    ],
    ["it was published", { status: "active" }, /it is active/],
    [
      "it was published once and taken back to draft",
      { first_published_at: "2026-11-01T00:00:00Z" },
      /has been published/,
    ],
    ["it is scheduled", { publish_at: "2026-12-01T17:00:00Z" }, /scheduled/],
    ["it was canceled", { canceled_at: "2026-11-02T00:00:00Z" }, /canceled/],
    ["an admin saved builder work", { working_document: { version: 1 } }, /builder work/],
  ])("leaves the row alone when %s", (_, overrides, reason) => {
    const [decision] = planProdEvents([seed], [untouched(overrides)], new Set());
    expect(decision).toMatchObject({ slug: seed.event.slug, action: "skip", id: "event-1" });
    expect(decision.action === "skip" && decision.reason).toMatch(reason);
  });

  it("leaves a demo event somebody registered for alone, however untouched", () => {
    const [decision] = planProdEvents([seed], [untouched()], new Set(["event-1"]));
    expect(decision).toMatchObject({ action: "skip" });
    expect(decision.action === "skip" && decision.reason).toMatch(/registered/);
  });

  it("decides each seed event on its own row", () => {
    const [first, second, third] = seeds;
    const decisions = planProdEvents(
      [first, second, third],
      [
        {
          ...untouched({ id: "real", slug: second.event.slug }),
          name: "A real event",
        },
        {
          ...untouched({ id: "demo", slug: third.event.slug }),
          name: third.event.name!,
          short_description: third.event.short_description ?? null,
          description: third.event.description ?? null,
        },
      ],
      new Set()
    );

    expect(decisions.map((decision) => decision.action)).toEqual([
      "create",
      "skip",
      "update",
    ]);
    expect(describeSkippedEvents(decisions)).toEqual([
      expect.stringContaining(`${second.event.slug}: left untouched`),
    ]);
  });
});
