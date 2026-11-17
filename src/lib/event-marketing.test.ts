import { describe, expect, it } from "vitest";
import { publicMarketingDestination } from "./event-marketing";

const row = (over: Partial<Parameters<typeof publicMarketingDestination>[0]>) => ({
  configured_marketing_mode: null, configured_marketing_url: null, marketing_url: null, ...over,
});

describe("publicMarketingDestination", () => {
  it("treats a legacy row with no URL as hosted", () => {
    expect(publicMarketingDestination(row({}))).toEqual({ kind: "hosted" });
  });
  it("treats a legacy row with a URL as external", () => {
    expect(publicMarketingDestination(row({ marketing_url: "https://example.com/e" }))).toEqual({ kind: "external", url: "https://example.com/e" });
  });
  it("follows the saved mode over the legacy column", () => {
    expect(publicMarketingDestination(row({ configured_marketing_mode: "hosted", marketing_url: "https://example.com" }))).toEqual({ kind: "hosted" });
    expect(publicMarketingDestination(row({ configured_marketing_mode: "disabled", marketing_url: "https://example.com" }))).toEqual({ kind: "none" });
  });
  it("prefers the configured URL for external", () => {
    expect(publicMarketingDestination(row({ configured_marketing_mode: "external", configured_marketing_url: "https://a.test", marketing_url: "https://b.test" }))).toEqual({ kind: "external", url: "https://a.test" });
  });
  it("is none for an external setting without a safe URL", () => {
    expect(publicMarketingDestination(row({ configured_marketing_mode: "external" }))).toEqual({ kind: "none" });
    expect(publicMarketingDestination(row({ configured_marketing_mode: "external", configured_marketing_url: "javascript:alert(1)" }))).toEqual({ kind: "none" });
  });
  it("is none for an unknown mode", () => {
    expect(publicMarketingDestination(row({ configured_marketing_mode: "bogus" }))).toEqual({ kind: "none" });
  });
});
