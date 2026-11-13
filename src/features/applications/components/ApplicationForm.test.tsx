// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationQuestion } from "../lib/application-form";

const actions = vi.hoisted(() => ({
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
  deleteApplication: vi.fn(),
  startApplicationDraft: vi.fn(),
}));
vi.mock("../actions", () => actions);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/features/settings/components/SettingsDialog", () => ({ openSettings: vi.fn() }));
// Its illustration is a static image import, which only Next's bundler sizes.
vi.mock("./ApplicationSubmittedDialog", () => ({ ApplicationSubmittedDialog: () => null }));

import { ApplicationForm, type ApplicationFormProps } from "./ApplicationForm";

const QUESTIONS: ApplicationQuestion[] = [
  {
    id: "why",
    question: "Why do you want to join?",
    description: null,
    response_type: "long_text",
    is_required: true,
    max_char_limit: null,
    response_options: null,
  },
  {
    id: "year",
    question: "Year",
    description: null,
    response_type: "multiple_choice",
    is_required: true,
    max_char_limit: null,
    response_options: ["1", "2"],
  },
];

function renderForm(overrides: Partial<ApplicationFormProps> = {}) {
  return render(
    <ApplicationForm
      event={{ id: "event-1", slug: "uxathon", name: "UXathon" }}
      status="draft"
      applicationId="app-1"
      window="open"
      opensAt={null}
      closesAt={null}
      submittedAt={null}
      profile={{ name: "Ada", email: "ada@example.com", studentNumber: "1", year: "3rd year" }}
      questions={QUESTIONS}
      initialAnswers={{ why: "", year: "" }}
      {...overrides}
    />
  );
}

/** A promise the test resolves. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const tick = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

beforeEach(() => {
  vi.useFakeTimers();
  for (const action of Object.values(actions)) action.mockReset();
  actions.saveApplicationDraft.mockResolvedValue({ ok: true, applicationId: "app-1" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ApplicationForm autosave", () => {
  it("has no Save draft button", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /save draft/i })).toBeNull();
    expect(screen.getByText("Saves automatically")).toBeTruthy();
  });

  it("saves typed text a second after the last keystroke, sending only what changed", async () => {
    renderForm();
    const textarea = screen.getByRole("textbox");

    fireEvent.change(textarea, { target: { value: "Because" } });
    await tick(999);
    expect(actions.saveApplicationDraft).not.toHaveBeenCalled();
    expect(screen.getByText("Saving…")).toBeTruthy();

    await tick(1);
    expect(actions.saveApplicationDraft).toHaveBeenCalledExactlyOnceWith("event-1", {
      why: "Because",
    });
    expect(screen.getByText(/^Saved/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Your answers are saved.");
  });

  it("saves text on blur without waiting", async () => {
    renderForm();
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Because" } });
    fireEvent.blur(textarea);
    await tick();
    expect(actions.saveApplicationDraft).toHaveBeenCalledOnce();
  });

  it("saves a choice at once", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    await tick();
    expect(actions.saveApplicationDraft).toHaveBeenCalledExactlyOnceWith("event-1", {
      year: "2",
    });
  });

  it("keeps an edit made during a save and sends it next", async () => {
    const first = deferred<unknown>();
    actions.saveApplicationDraft.mockReturnValueOnce(first.promise);
    renderForm();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "One" } });
    fireEvent.blur(textarea);
    await tick();
    fireEvent.change(textarea, { target: { value: "One two" } });
    await tick(5000);
    expect(actions.saveApplicationDraft).toHaveBeenCalledOnce();

    first.resolve({ ok: true, applicationId: "app-1" });
    await tick(1000);
    expect(textarea.value).toBe("One two");
    expect(actions.saveApplicationDraft).toHaveBeenLastCalledWith("event-1", { why: "One two" });
  });

  it("shows Couldn't save with Retry after the retries fail", async () => {
    actions.saveApplicationDraft.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    await tick(5000);
    expect(actions.saveApplicationDraft).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Couldn’t save")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Your answers couldn’t be saved.");

    actions.saveApplicationDraft.mockResolvedValue({ ok: true, applicationId: "app-1" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await tick();
    expect(actions.saveApplicationDraft).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/^Saved/)).toBeTruthy();
  });

  it("stops autosaving once the server refuses", async () => {
    actions.saveApplicationDraft.mockResolvedValue({
      ok: false,
      error: "Applications for this event have closed.",
      reason: "closed",
    });
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    await tick(5000);
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    await tick(5000);
    expect(actions.saveApplicationDraft).toHaveBeenCalledOnce();
  });

  it("Submit saves the pending edit first, then submits, never both at once", async () => {
    const save = deferred<unknown>();
    actions.saveApplicationDraft.mockReturnValueOnce(save.promise);
    actions.submitApplication.mockResolvedValue({ ok: true, applicationId: "app-1" });
    renderForm();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Because" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await tick();
    expect(actions.saveApplicationDraft).toHaveBeenCalledOnce();
    expect(actions.submitApplication).not.toHaveBeenCalled();

    save.resolve({ ok: true, applicationId: "app-1" });
    await tick();
    expect(actions.submitApplication).toHaveBeenCalledExactlyOnceWith("event-1", {
      why: "Because",
      year: "",
    });
  });

  it("doesn't autosave a submitted application", async () => {
    renderForm({ status: "submitted", initialAnswers: { why: "Done", year: "1" } });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("Saves automatically")).toBeNull();
  });
});
