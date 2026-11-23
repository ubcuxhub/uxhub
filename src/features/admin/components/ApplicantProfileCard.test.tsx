// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));

import { ApplicantProfileCard, type ApplicantProfile } from "./ApplicantProfileCard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const priya: ApplicantProfile = {
  name: "Priya Raman",
  email: "priya.raman@student.ubc.ca",
  program: "Cognitive Systems",
  year: "3",
  studentStatus: "undergraduate",
  membership: "nonUbc",
};

const value = (label: string) => {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
};

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("ApplicantProfileCard", () => {
  it("shows each profile field in words", () => {
    render(<ApplicantProfileCard applicant={priya} submittedAt="2026-11-06T23:14:00Z" />);

    expect(screen.getByRole("region", { name: "Profile" })).toBeTruthy();
    expect(screen.getByText("Priya Raman")).toBeTruthy();
    expect(screen.getByText("Submitted Nov 6, 2026")).toBeTruthy();
    expect(value("Year").textContent).toBe("3rd year");
    expect(value("Program").textContent).toBe("Cognitive Systems");
    expect(value("Membership").textContent).toBe("Non UBC");
    expect(value("Student status").textContent).toBe("Undergraduate");
    expect(value("Submitted").textContent).toBe("Nov 6, 2026, 4:14 PM");
    expect(
      within(value("Email")).getByRole("link", { name: priya.email }).getAttribute("href")
    ).toBe(`mailto:${priya.email}`);
  });

  it("reads a missing value as a dash and no membership as Non-member", () => {
    render(
      <ApplicantProfileCard
        applicant={{ ...priya, email: "", program: null, year: null, studentStatus: null, membership: null }}
        submittedAt="2026-11-06T23:14:00Z"
      />
    );

    for (const label of ["Email", "Year", "Program", "Student status"]) {
      expect(value(label).textContent).toBe("—None");
    }
    expect(value("Membership").textContent).toBe("Non-member");
    expect(screen.queryByRole("button", { name: "Copy email" })).toBeNull();
  });

  it("leaves the identity to the page header when asked", () => {
    render(
      <ApplicantProfileCard applicant={priya} submittedAt="2026-11-06T23:14:00Z" showIdentity={false} />
    );
    expect(screen.queryByText("Priya Raman")).toBeNull();
  });

  it("copies the email, and says so when the clipboard is blocked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<ApplicantProfileCard applicant={priya} submittedAt="2026-11-06T23:14:00Z" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Email copied"));
    expect(writeText).toHaveBeenCalledWith(priya.email);

    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
