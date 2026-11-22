// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationQuestion } from "../lib/application-form";

const actions = vi.hoisted(() => ({
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
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

const submitArea = () => screen.getByRole("region", { name: "Submit your application" });
const header = () => screen.getByRole("banner");

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  // jsdom has no layout, so jumping to a question only needs this to exist.
  Element.prototype.scrollIntoView = vi.fn();
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
    fireEvent.click(within(submitArea()).getByRole("button", { name: "Submit" }));
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

describe("ApplicationForm after a profile edit", () => {
  it("shows the new About you and keeps the answers and the save in progress", async () => {
    const props: ApplicationFormProps = {
      event: { id: "event-1", slug: "uxathon", name: "UXathon" },
      status: "draft",
      window: "open",
      opensAt: null,
      closesAt: null,
      submittedAt: null,
      profile: { name: "Ada", email: "ada@example.com", studentNumber: "1", year: "3rd year" },
      questions: QUESTIONS,
      initialAnswers: { why: "", year: "" },
    };
    const { rerender } = render(<ApplicationForm {...props} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Because" } });
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    await tick();
    expect(actions.saveApplicationDraft).toHaveBeenLastCalledWith("event-1", {
      why: "Because",
      year: "2",
    });
    fireEvent.change(textarea, { target: { value: "Because I" } });

    // What `router.refresh()` does once Settings closes: the page renders
    // again with the new profile, and with answers read before the last edit.
    rerender(
      <ApplicationForm
        {...props}
        profile={{ name: "Ada Lovelace", email: "ada@example.com", studentNumber: "31415926", year: "4th year" }}
        initialAnswers={{ why: "", year: "" }}
      />
    );

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("31415926")).toBeTruthy();
    expect(screen.getByText("4th year")).toBeTruthy();
    expect(screen.queryByText("3rd year")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Because I");
    expect((screen.getByRole("radio", { name: "2" }) as HTMLElement).getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(screen.getByText("Saving…")).toBeTruthy();

    // The pending edit still saves, alone: the rest already went.
    await tick(1000);
    expect(actions.saveApplicationDraft).toHaveBeenCalledTimes(2);
    expect(actions.saveApplicationDraft).toHaveBeenLastCalledWith("event-1", { why: "Because I" });
    expect(screen.getByText(/^Saved/)).toBeTruthy();
  });
});

describe("ApplicationForm layout", () => {
  it("offers no way to delete the application", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.queryByText(/delete/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Other settings" })).toBeNull();
  });

  it("numbers only About you and Your answers, in the page and the navigator", () => {
    renderForm();
    expect(screen.queryByRole("heading", { name: "Review and submit" })).toBeNull();
    const navigator = screen.getByRole("button", { name: /section 1 of 2/ });
    fireEvent.keyDown(navigator, { key: "Enter" });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(/About you/);
    expect(items[1]).toMatch(/Your answers/);
  });
});

describe("ApplicationForm submit area", () => {
  it("lists what is left to answer and jumps to it", async () => {
    renderForm();
    const area = within(submitArea());
    expect(area.getByText("2 left to answer")).toBeTruthy();
    expect(area.getByText("Once you submit, you can’t edit your answers.")).toBeTruthy();

    fireEvent.click(area.getByRole("button", { name: "Question 1" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));

    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    await tick();
    expect(area.getByText("1 left to answer")).toBeTruthy();
    expect(area.queryByRole("button", { name: "Question 2" })).toBeNull();
  });

  it("drops the list once everything is answered, keeping Submit", () => {
    renderForm({ initialAnswers: { why: "Because", year: "1" } });
    const area = within(submitArea());
    expect(area.queryByText(/left to answer/)).toBeNull();
    expect(area.queryByRole("button", { name: /^Question/ })).toBeNull();
    expect((area.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    ["the submit area", submitArea],
    ["the header", header],
  ])("submits from %s, and both buttons show it", async (_where, container) => {
    const submitted = deferred<unknown>();
    actions.submitApplication.mockReturnValueOnce(submitted.promise);
    renderForm({ initialAnswers: { why: "Because", year: "1" } });

    fireEvent.click(within(container()).getByRole("button", { name: "Submit" }));
    await tick();
    expect(actions.submitApplication).toHaveBeenCalledExactlyOnceWith("event-1", {
      why: "Because",
      year: "1",
    });
    for (const button of screen.getAllByRole("button", { name: /Submitting/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getAllByRole("button", { name: /Submitting/ })).toHaveLength(2);

    submitted.resolve({ ok: true, applicationId: "app-1" });
    await tick();
    expect(screen.queryByRole("button", { name: /Submit/ })).toBeNull();
  });

  it("disables both Submit buttons while applications aren't open", () => {
    renderForm({ window: "not_open", opensAt: "December 1, 2026 at 9:00 AM" });
    expect(within(submitArea()).getByText("Applications aren’t open yet")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Submit" }) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it("has no submit area once submitted", () => {
    renderForm({ status: "submitted", initialAnswers: { why: "Done", year: "1" } });
    expect(screen.queryByRole("region", { name: "Submit your application" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Submit/ })).toBeNull();
    expect(screen.queryByText(/left to answer/)).toBeNull();
    expect(screen.queryByText("Once you submit, you can’t edit your answers.")).toBeNull();
  });
});
