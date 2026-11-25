// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApplicationTiming } from "./ApplicationTiming";
import { defaultFormState, type EventFormState } from "./event-form-schema";

afterEach(cleanup);
function Form({ initial = defaultFormState, savedReleaseAt = null, decidedApplications = 0 }: { initial?: EventFormState; savedReleaseAt?: string | null; decidedApplications?: number }) {
  const [state, setState] = useState(initial);
  return <><ApplicationTiming state={state} showErrors savedReleaseAt={savedReleaseAt} decidedApplications={decidedApplications} onChange={(key, value) => setState(current => ({ ...current, [key]: value }))} /><output>{JSON.stringify(state)}</output></>;
}
const stored = () => JSON.parse(screen.getByRole("status", { hidden: true }).textContent!) as EventFormState;
const toggle = () => screen.getByRole("switch", { name: "Release decisions at a set time" });

it("retains partial input, exposes errors, and clears optional Pacific moments", () => {
  render(<Form />);
  const date = screen.getByLabelText("Confirm by (optional)");
  fireEvent.change(date, { target: { value: "11/16/2026" } });
  fireEvent.blur(date);
  expect(screen.getAllByText(/valid, unambiguous Pacific/).length).toBeGreaterThan(0);
  const time = screen.getByLabelText("Confirm by time");
  fireEvent.change(time, { target: { value: "10 am" } });
  fireEvent.blur(time);
  expect(stored().confirmation_deadline).toBe("2026-11-16T10:00");
  expect(screen.queryByText(/valid, unambiguous Pacific/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear confirm by" }));
  expect(stored().confirmation_deadline).toBe("");
});

it("hides the release behind a switch and restores it when switched back on", () => {
  render(<Form />);
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(screen.queryByLabelText("Release decisions on")).toBeNull();
  fireEvent.click(toggle());
  const date = screen.getByLabelText("Release decisions on");
  fireEvent.change(date, { target: { value: "11/16/2026" } });
  fireEvent.blur(date);
  const time = screen.getByLabelText("Release decisions on time");
  fireEvent.change(time, { target: { value: "10 am" } });
  fireEvent.blur(time);
  expect(stored().decisions_release_at).toBe("2026-11-16T10:00");
  fireEvent.click(toggle());
  expect(stored().decisions_release_at).toBe("");
  expect(screen.queryByLabelText("Release decisions on")).toBeNull();
  fireEvent.click(toggle());
  expect(stored().decisions_release_at).toBe("2026-11-16T10:00");
});

it("asks before showing decisions that are still hidden", () => {
  render(<Form initial={{ ...defaultFormState, decisions_release_at: "2099-01-01T09:00" }} savedReleaseAt="2099-01-01T17:00:00Z" decidedApplications={3} />);
  fireEvent.click(toggle());
  expect(screen.getByText(/3 decisions are hidden/)).toBeTruthy();
  expect(stored().decisions_release_at).toBe("2099-01-01T09:00");
  fireEvent.click(screen.getByRole("button", { name: "Keep the release time" }));
  expect(stored().decisions_release_at).toBe("2099-01-01T09:00");
  fireEvent.click(toggle());
  fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
  expect(stored().decisions_release_at).toBe("");
});

it("locks the switch once applicants can see decisions", () => {
  render(<Form decidedApplications={1} />);
  expect(toggle().hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(/can already see decisions/)).toBeTruthy();
  cleanup();
  render(<Form initial={{ ...defaultFormState, decisions_release_at: "2020-01-01T09:00" }} savedReleaseAt="2020-01-01T17:00:00Z" />);
  expect(toggle().hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText("Release decisions on")).toBeTruthy();
});
