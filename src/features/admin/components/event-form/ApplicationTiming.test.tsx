// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApplicationTiming } from "./ApplicationTiming";
import { defaultFormState } from "./event-form-schema";

afterEach(cleanup);
function Form() {
  const [state, setState] = useState(defaultFormState);
  return <><ApplicationTiming state={state} showErrors onChange={(key, value) => setState(current => ({ ...current, [key]: value }))} /><output>{JSON.stringify(state)}</output></>;
}
it("retains partial input, exposes errors, and clears optional Pacific moments", () => {
  render(<Form />);
  const date = screen.getByLabelText("Release decisions on (optional)");
  fireEvent.change(date, { target: { value: "11/16/2026" } });
  fireEvent.blur(date);
  expect(screen.getAllByText(/valid, unambiguous Pacific/).length).toBeGreaterThan(0);
  const time = screen.getByLabelText("Release decisions on time");
  fireEvent.change(time, { target: { value: "10 am" } });
  fireEvent.blur(time);
  expect(JSON.parse(screen.getByRole("status").textContent!).decisions_release_at).toBe("2026-11-16T10:00");
  expect(screen.queryByText(/valid, unambiguous Pacific/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear release decisions on" }));
  expect(JSON.parse(screen.getByRole("status").textContent!).decisions_release_at).toBe("");
});
