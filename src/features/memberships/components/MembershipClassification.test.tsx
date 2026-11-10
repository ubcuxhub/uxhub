// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserType } from "@/lib/supabase/models";
import { MembershipClassification } from "./MembershipClassification";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function renderStep(initialUserType: UserType = "ubcStudent", returnTo?: string) {
  return render(
    <MembershipClassification
      initialUserType={initialUserType}
      returnTo={returnTo}
    />,
  );
}

describe("MembershipClassification", () => {
  beforeEach(() => replace.mockClear());
  afterEach(cleanup);

  it("renders a radio group labelled by the heading with the user type preselected", () => {
    renderStep("faculty");
    expect(
      screen.getByRole("radiogroup", { name: "What best describes you?" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen
        .getByRole("radio", { name: /UBC faculty member/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("selects an option on click and navigates with it", () => {
    renderStep("ubcStudent", "/portal/events");
    const outsider = screen.getByRole("radio", { name: /not from UBC/ });
    fireEvent.click(outsider);
    expect(outsider.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(replace).toHaveBeenCalledTimes(1);
    const url = String(replace.mock.calls[0][0]);
    expect(url).toContain("/portal/membership/join/non-ubc");
    expect(url).toContain("returnTo");
  });

  it("moves the selection with the arrow keys", async () => {
    renderStep();
    const student = screen.getByRole("radio", { name: /UBC student/ });
    student.focus();
    fireEvent.keyDown(student, { key: "ArrowDown" });
    const faculty = screen.getByRole("radio", { name: /UBC faculty/ });
    await waitFor(() =>
      expect(faculty.getAttribute("aria-checked")).toBe("true"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(String(replace.mock.calls[0][0])).toContain("/join/faculty");
  });
});
