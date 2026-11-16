import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventRow } from "@/lib/supabase/models";
import { EventDraftSections } from "./EventDraftSections";
const secret = "https://example.test/staff-private-token";
vi.mock("@/features/admin/lib/event-presentation", () => ({ eventWorkingDocument: () => ({ formState: { content: { sections: [], links: [
  { id: "staff", type: "volunteer_schedule", visibility: "staff", label: "Volunteer Schedule", url: "https://example.test/staff-private-token" },
  { id: "public", type: "other", visibility: "everyone", label: "Public resource", url: "https://example.test/public" },
] } } }) }));
it("excludes the staff resource from participant-style draft sections", () => {
  const html = renderToStaticMarkup(<EventDraftSections event={{} as EventRow} />);
  expect(html).not.toContain(secret);
  expect(html).not.toContain("Volunteer Schedule");
  expect(html).toContain("https://example.test/public");
});
