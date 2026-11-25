// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ flags: { studentEvents: true } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock("@/lib/flags", () => ({ FLAGS: mocks.flags }));
vi.mock("@/lib/auth/user-context", () => ({
  useUser: () => ({ user: null, membershipTermEndsAt: null, loading: false }),
  UserProvider: ({ children }: { children: ReactNode }) => children,
}));

import Navbar from "./Navbar";

afterEach(cleanup);

// The desktop and phone links are both in the DOM; CSS shows one set.
const eventLinks = () => screen.queryAllByRole("link", { name: "Events" });

it("links to /events on desktop and on phones once student events launch", () => {
  mocks.flags.studentEvents = true;
  render(<Navbar />);
  expect(eventLinks().map((link) => link.getAttribute("href"))).toEqual(["/events", "/events"]);
});

it("has no Events link while they're off", () => {
  mocks.flags.studentEvents = false;
  render(<Navbar />);
  expect(eventLinks()).toEqual([]);
});
