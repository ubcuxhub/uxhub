// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationEditor } from "./LocationEditor";
import type { LocationDraft } from "@/lib/location";

afterEach(cleanup);
function Form() {
  const [value,setValue] = useState<LocationDraft>({ type: "in_person", building: "Nest", room: "2306", address: "UBC", map_url: "", meeting_url: "https://example.com", meeting_id: "123", meeting_passcode: "private", public_summary: "Vancouver" });
  return <LocationEditor prefix="test" value={value} onChange={setValue} restricted />;
}
it("retains inactive physical and meeting values through all location variants", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("radio", { name: "Online" }));
  expect((screen.getByLabelText("Passcode (optional)") as HTMLInputElement).value).toBe("private");
  fireEvent.change(screen.getByLabelText("Meeting link"), { target: { value: "https://example.com/changed" } });
  fireEvent.click(screen.getByRole("radio", { name: "In person" }));
  expect((screen.getByLabelText("Building") as HTMLInputElement).value).toBe("Nest");
  fireEvent.click(screen.getByRole("radio", { name: "Hybrid" }));
  expect((screen.getByLabelText("Meeting link") as HTMLInputElement).value).toBe("https://example.com/changed");
  expect((screen.getByLabelText("Room (optional)") as HTMLInputElement).value).toBe("2306");
  expect(screen.getByText(/Keep exact private details out/)).toBeTruthy();
});
