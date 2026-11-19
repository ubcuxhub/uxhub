// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/shared/FlowLink", () => ({
  FlowLink: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MembershipJoinBanner } from "./MembershipJoinBanner";

afterEach(cleanup);

it("invites a non-member to join and opens the membership flow", () => {
  render(<MembershipJoinBanner />);

  expect(screen.getByRole("region", { name: "Join the UX Hub community" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Become a member" }).getAttribute("href")).toBe(
    "/portal/membership/join",
  );
});
