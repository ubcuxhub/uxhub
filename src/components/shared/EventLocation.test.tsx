// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EventLocation } from "./EventLocation";
afterEach(cleanup);
it("shows only public copy for a restricted projection", () => {
  render(<EventLocation location={{ type: "hybrid", restricted: true, public_summary: "UBC", building: "Secret", meeting_url: "https://example.test/private", meeting_passcode: "private" }} />);
  expect(screen.getByText("UBC")).toBeTruthy();
  expect(screen.queryByText("Secret")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
it("displays hybrid details with safe links and labelled copy controls", () => {
  render(<EventLocation location={{ type: "hybrid", restricted: false, building: "ICICS", room: "200", address: "Main Mall", meeting_url: "https://example.test/join", map_url: "javascript:alert(1)", meeting_id: "123", meeting_passcode: "long-passcode" }} />);
  expect(screen.getByRole("link", { name: "Join online meeting" }).getAttribute("href")).toBe("https://example.test/join");
  expect(screen.queryByRole("link", { name: "View on map" })).toBeNull();
  expect(screen.getByRole("button", { name: "Copy meeting ID" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy meeting passcode" })).toBeTruthy();
  expect(screen.getByText("200")).toBeTruthy();
});
it("does not show inactive online fields for a physical location", () => {
  render(<EventLocation showRoom={false} location={{ type: "in_person", restricted: false, building: "ICICS", room: "200", meeting_id: "inactive" }} />);
  expect(screen.getByText("ICICS")).toBeTruthy();
  expect(screen.queryByText("200")).toBeNull();
  expect(screen.queryByText("inactive")).toBeNull();
});
