// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/events/design-sprint" }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

import { EventRegistrationAction } from "./EventRegistrationAction";

afterEach(cleanup);

const props = { eventId: "event-1", eventSlug: "design-sprint", unavailableLabel: "Event Full" };

describe("EventRegistrationAction", () => {
  it("registers through the checkout", () => {
    render(<EventRegistrationAction {...props} registrationAvailable />);
    const link = screen.getByRole("link", { name: "Register Now" });
    expect(link.getAttribute("href")).toBe("/portal/events/design-sprint/checkout?returnTo=%2Fevents%2Fdesign-sprint");
  });

  it("applies on the application form for an application event", () => {
    render(<EventRegistrationAction {...props} registrationAvailable requiresApplication />);
    expect(screen.queryByRole("link", { name: "Register Now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Apply" }).getAttribute("href")).toBe("/portal/events/design-sprint/apply");
  });

  it("shows why it's unavailable, application or not", () => {
    render(<EventRegistrationAction {...props} registrationAvailable={false} requiresApplication unavailableLabel="Event ended" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect((screen.getByRole("button", { name: "Event ended" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
