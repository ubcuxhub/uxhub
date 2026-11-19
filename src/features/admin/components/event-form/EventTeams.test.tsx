// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EventTeams } from "./EventTeams";
import { defaultFormState } from "./event-form-schema";

afterEach(cleanup);
function Form({ teams = 0, largest = 0 }: { teams?: number; largest?: number }) {
  const [state, setState] = useState({ ...defaultFormState, teams_enabled: teams > 0, min_team_size: "2", max_team_size: "4", team_deadline: "2026-11-16T10:00" });
  return <><EventTeams state={state} info={{ teamCount: teams, largestTeam: largest }} showErrors onChange={(key, value) => setState(current => ({ ...current, [key]: value }))} /><output>{JSON.stringify(state)}</output></>;
}
it("reveals, edits and hides settings without resetting retained values", () => {
  render(<Form />);
  expect(screen.queryByLabelText("Minimum team size (optional)")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
  fireEvent.change(screen.getByLabelText("Minimum team size (optional)"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("radio", { name: "No" }));
  expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({ teams_enabled: false, min_team_size: "3", max_team_size: "4", team_deadline: "2026-11-16T10:00" });
  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
  expect((screen.getByLabelText("Minimum team size (optional)") as HTMLInputElement).value).toBe("3");
  fireEvent.click(screen.getByRole("button", { name: "Clear team deadline" }));
  expect(JSON.parse(screen.getByRole("status").textContent!).team_deadline).toBe("");
});
it("locks disabling when a team exists and explains maximum-size violations", () => {
  render(<Form teams={2} largest={3} />);
  expect((screen.getByRole("radio", { name: "No" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Maximum team size (optional)"), { target: { value: "2" } });
  const max = screen.getByLabelText("Maximum team size (optional)");
  expect(max.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText(/Maximum team size cannot be below 3/)).toBeTruthy();
  expect(screen.getByText(/2 teams exist/)).toBeTruthy();
});
it("shows associated errors for reversed limits and incomplete deadline", () => {
  render(<Form teams={1} largest={1} />);
  fireEvent.change(screen.getByLabelText("Minimum team size (optional)"), { target: { value: "5" } });
  expect(screen.getByRole("alert").textContent).toMatch(/cannot exceed/);
  fireEvent.change(screen.getByLabelText("Minimum team size (optional)"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Team deadline time"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("Team deadline time"));
  expect(screen.getByRole("alert").textContent).toMatch(/valid, unambiguous/);
});
