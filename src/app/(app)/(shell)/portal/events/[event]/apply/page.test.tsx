import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ event: vi.fn(), application: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("404"); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: async () => ({ id: "user-1", first_name: "Ada", last_name: "L", email: "a@example.test", student_number: null, year: null }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventBySlug: mocks.event }));
vi.mock("@/lib/supabase-helpers/application-files", () => ({ createApplicationFileUrl: vi.fn() }));
vi.mock("@/lib/supabase-helpers/event-applications", () => ({
  fetchApplicationQuestions: async () => [],
  fetchApplicationResponses: async () => [],
  fetchUserEventApplication: mocks.application,
}));
vi.mock("@/features/applications/components/ApplicationForm", () => ({ ApplicationForm: () => null }));

import ApplyPage from "./page";

const hour = 3600_000;
const at = (offset: number) => new Date(Date.now() + offset).toISOString();
const event = {
  id: "event-1", slug: "uxathon", name: "UXathon", requires_application: true,
  starts_at: at(48 * hour), ends_at: at(50 * hour), canceled_at: null,
  registration_opens_at: null, registration_closes_at: null,
};
const load = () => ApplyPage({ params: Promise.resolve({ event: "uxathon" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.event.mockResolvedValue(event);
  mocks.application.mockResolvedValue(null);
});

it("opens the form while the event takes applications", async () => {
  const form = (await load()) as ReactElement<{ window: string }>;
  expect(form.props.window).toBe("open");
});

it.each([
  ["canceled", { canceled_at: at(-hour) }],
  ["ended", { starts_at: at(-3 * hour), ends_at: at(-hour) }],
  ["ended, without an end time", { starts_at: at(-hour), ends_at: null }],
])("sends a %s event back to its event page", async (_label, over) => {
  mocks.event.mockResolvedValue({ ...event, ...over });
  await expect(load()).rejects.toThrow("redirect:/portal/events/uxathon");
  expect(mocks.application).not.toHaveBeenCalled();
});
