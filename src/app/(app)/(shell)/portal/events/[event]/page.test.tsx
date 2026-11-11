import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: vi.fn(async () => ({ id: "viewer" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventBySlug: vi.fn() }));
vi.mock("@/lib/supabase-helpers/event-agenda", () => ({ fetchEventAgenda: vi.fn() }));
vi.mock("@/lib/supabase-helpers/event-people", () => ({ fetchEventMentors: vi.fn(), fetchEventSponsors: vi.fn() }));
vi.mock("@/features/events/lib/event-badge", () => ({ loadEventBadges: vi.fn(async () => ({})) }));
vi.mock("@/features/applications/components/ApplicationStatusCallout", () => ({ ApplicationStatusCallout: () => null }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/shared/FlowLink", () => ({ FlowLink: ({ children }: { children: ReactNode }) => <span>{children}</span> }));

import PortalEventPage from "./page";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchEventAgenda } from "@/lib/supabase-helpers/event-agenda";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchEventAgenda).mockResolvedValue([{
    id: "day", event_id: "event", date: "2026-11-14", title: "Kickoff",
    items: [{ id: "activity", event_agenda_day_id: "day", title: "Welcome activity", start_time: "09:00:00", end_time: "10:00:00", building: "Nest", room: "Lobby" }],
  }]);
});

it.each([true, false])("uses saved agenda visibility %s on the existing event page", async enabled => {
  vi.mocked(fetchEventBySlug).mockResolvedValue({
    id: "event", slug: "design-sprint", name: "Design Sprint", status: "active",
    agenda_enabled: enabled, mentors_enabled: false, sponsors_enabled: false,
    starts_at: "2026-11-14T17:00:00Z", ends_at: "2026-11-14T18:00:00Z",
  } as EventRow);
  const markup = renderToStaticMarkup(await PortalEventPage({ params: Promise.resolve({ event: "design-sprint" }) }));
  expect(markup.includes("Design Sprint Agenda")).toBe(enabled);
  expect(markup.includes("Welcome activity")).toBe(enabled);
  expect(fetchEventAgenda).toHaveBeenCalledTimes(enabled ? 1 : 0);
});
