import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/supabase/models";
import { CheckInManager } from "./CheckInManager";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/features/admin/actions", () => ({ fetchAdminCheckInSnapshotAction: vi.fn(), toggleCheckInAction: vi.fn() }));
vi.mock("./CheckInTable", () => ({ CheckInTable: () => null }));

it.each([
  { max_capacity: null, regular_price: null, member_price: null, capacity: "Not set", price: "Not set" },
  { max_capacity: 0, regular_price: 0, member_price: 0, capacity: "0 attendees", price: "$0.00" },
])("distinguishes unset capacity and prices from explicit zero values: $capacity", ({ capacity, price, ...values }) => {
  const event = { id: "event-1", name: "Saved event", ...values } as EventRow;
  const html = renderToStaticMarkup(<CheckInManager eventId={event.id} event={event} initialCheckInSessions={[]} initialAttendees={[]} initialCheckInStatuses={[]} />);
  expect(html).toContain(`>${capacity}</p>`);
  expect(html).toContain(`>${price}</p>`);
  if (values.regular_price === null) expect(html).not.toContain("$0.00");
});
