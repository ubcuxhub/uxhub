// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ApplicationQuestion } from "@/features/applications/lib/application-form";

import { CheckboxGroupField } from "./CheckboxGroupField";
import { ChoiceCardsField } from "./ChoiceCardsField";
import { DropdownField } from "./DropdownField";
import { FileField, formatFileSize } from "./FileField";
import { LongTextField } from "./LongTextField";
import { QuestionField } from "./QuestionField";
import { ShortTextField } from "./ShortTextField";

beforeAll(() => {
  // Radix sizes hidden inputs with a ResizeObserver, which jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(cleanup);

function question(overrides: Partial<ApplicationQuestion> = {}): ApplicationQuestion {
  return {
    id: "q1",
    question: "How much UX experience do you have?",
    description: null,
    response_type: "short_text",
    is_required: true,
    max_char_limit: null,
    response_options: null,
    ...overrides,
  };
}

const noop = () => {};

describe("ChoiceCardsField", () => {
  const choice = question({ response_type: "multiple_choice", response_options: ["Beginner", "Advanced"] });

  it("numbers the question as the group's legend and picks an option", () => {
    const onChange = vi.fn();
    render(<ChoiceCardsField question={choice} number={1} value="" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "1. How much UX experience do you have?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Advanced" }));
    expect(onChange).toHaveBeenCalledWith("Advanced");
  });

  it("shows the error and marks the radios invalid", () => {
    render(
      <ChoiceCardsField question={choice} number={1} value="" error="Choose an answer." onChange={noop} />
    );
    expect(screen.getByRole("alert").textContent).toBe("Choose an answer.");
    expect(screen.getByRole("radio", { name: "Beginner" }).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("radiogroup").getAttribute("aria-describedby")).toContain(
      screen.getByRole("alert").id
    );
  });
});

describe("CheckboxGroupField", () => {
  const roles = question({
    question: "Which roles are you interested in?",
    response_type: "checkbox",
    response_options: ["Research", "Design, UI", "Prototyping"],
    is_required: false,
  });

  it("marks optional questions and keeps the options' order", () => {
    const onChange = vi.fn();
    render(<CheckboxGroupField question={roles} number={3} value={["Prototyping"]} onChange={onChange} />);
    expect(screen.getByText(/3\. Which roles are you interested in\? \(optional\)/)).toBeTruthy();
    expect(screen.getByText("Pick any")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Research" }));
    expect(onChange).toHaveBeenLastCalledWith(["Research", "Prototyping"]);
  });

  it("unchecks an option", () => {
    const onChange = vi.fn();
    render(
      <CheckboxGroupField question={roles} number={3} value={["Research", "Design, UI"]} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Design, UI" }));
    expect(onChange).toHaveBeenLastCalledWith(["Research"]);
  });
});

describe("LongTextField", () => {
  it("labels the textarea and counts toward the limit", () => {
    const onChange = vi.fn();
    render(
      <LongTextField
        question={question({ question: "Why?", response_type: "long_text", max_char_limit: 500 })}
        number={2}
        value="Hello"
        onChange={onChange}
      />
    );
    const textarea = screen.getByRole("textbox", { name: "2. Why?" });
    expect(textarea.getAttribute("maxlength")).toBe("500");
    expect(screen.getByText("5/500")).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    expect(onChange).toHaveBeenCalledWith("Hello!");
  });

  it("shows no counter without a limit", () => {
    render(
      <LongTextField question={question({ response_type: "long_text" })} number={2} value="" onChange={noop} />
    );
    expect(screen.queryByText(/\/\d+/)).toBeNull();
  });
});

describe("ShortTextField", () => {
  it("describes the input with its error", () => {
    render(
      <ShortTextField
        question={question({ question: "Teammates" })}
        number={5}
        value=""
        error="Enter an answer."
        onChange={noop}
      />
    );
    const input = screen.getByRole("textbox", { name: "5. Teammates" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });
});

describe("DropdownField", () => {
  it("names the trigger by the question and shows the placeholder", () => {
    render(
      <DropdownField
        question={question({ question: "Session", response_type: "dropdown", response_options: ["Sat", "Sun"] })}
        number={4}
        value=""
        onChange={noop}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "4. Session" });
    expect(trigger.textContent).toContain("Choose an option");
  });
});

describe("FileField", () => {
  const resume = question({ question: "Resume", response_type: "file_upload", is_required: false });
  const pdf = (size = 10) =>
    new File([new Uint8Array(size)], "resume.pdf", { type: "application/pdf" });

  it("always promises PDF up to 5 MB", () => {
    render(
      <FileField question={resume} number={6} value="" onUpload={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("PDF, up to 5 MB")).toBeTruthy();
    expect(screen.getByLabelText("6. Resume (optional)").getAttribute("type")).toBe("file");
  });

  it("refuses a file that isn't a PDF without uploading it", async () => {
    const onUpload = vi.fn();
    render(<FileField question={resume} number={6} value="" onUpload={onUpload} onRemove={vi.fn()} />);
    const input = screen.getByLabelText("6. Resume (optional)");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    expect((await screen.findByRole("alert")).textContent).toBe("Upload a PDF.");
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("uploads a PDF and shows the error it comes back with", async () => {
    const onUpload = vi.fn().mockResolvedValue("The file couldn't be uploaded. Try again.");
    render(<FileField question={resume} number={6} value="" onUpload={onUpload} onRemove={vi.fn()} />);
    const file = pdf();
    fireEvent.change(screen.getByLabelText("6. Resume (optional)"), { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The file couldn't be uploaded. Try again."
    );
  });

  it("shows an uploaded file's name and size, and removes it", async () => {
    const onRemove = vi.fn().mockResolvedValue(null);
    render(
      <FileField
        question={resume}
        number={6}
        value="user/app/q1/resume.pdf"
        fileSize={240 * 1024}
        onUpload={vi.fn()}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText("resume.pdf")).toBeTruthy();
    expect(screen.getByText(/240 KB/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove resume.pdf" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
  });

  it("formats sizes", () => {
    expect(formatFileSize(100)).toBe("1 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("QuestionField", () => {
  it("picks the control for each response type", () => {
    const { rerender } = render(
      <QuestionField
        question={question({ response_type: "checkbox", response_options: ["A"] })}
        number={1}
        value={[]}
        onChange={noop}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole("checkbox", { name: "A" })).toBeTruthy();

    rerender(
      <QuestionField
        question={question({ response_type: "long_text" })}
        number={1}
        value=""
        onChange={noop}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
  });
});
