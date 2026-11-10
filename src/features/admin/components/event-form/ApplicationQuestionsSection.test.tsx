// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useApplicationQuestions } from "../../hooks/use-application-questions";
import { ApplicationQuestionsSection } from "./ApplicationQuestionsSection";
import { act } from "react";

const questions = [
  { id: "one", question: "Why?", description: "Retained description", response: "short_text" as const, max_char_limit: 200, is_required: true, response_options: [] },
  { id: "two", question: "Year?", description: "", response: "dropdown" as const, max_char_limit: "" as const, is_required: false, response_options: ["1", "2"] },
];
afterEach(cleanup);
function Form({ locked = false }: { locked?: boolean }) {
  const form = useApplicationQuestions(() => {}, questions);
  return <><ApplicationQuestionsSection enabled registrationModeOwned locked={locked} applicationTemplate={form.applicationTemplate} questionErrors={form.questionErrors} onMove={form.moveApplicationQuestion} onEnabledChange={() => {}} onAdd={form.addApplicationQuestion} onRemove={form.removeApplicationQuestion} onUpdate={form.updateApplicationQuestion} onAddResponseOption={form.addResponseOption} onUpdateResponseOption={form.updateResponseOption} onRemoveResponseOption={form.removeResponseOption} /><output>{JSON.stringify(form.applicationTemplate)}</output></>;
}
it("edits and reorders questions while preserving ids and omitted historical descriptions", () => {
  render(<Form />);
  expect(screen.queryByLabelText(/Description/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Move question 2 up" }));
  const inputs = screen.getAllByLabelText("Question") as HTMLInputElement[];
  expect(inputs.map(input => input.value)).toEqual(["Year?", "Why?"]);
  fireEvent.change(inputs[1], { target: { value: "Why attend?" } });
  fireEvent.click(screen.getByRole("button", { name: "File upload" }));
  expect(screen.getByText(/Applicants upload one PDF/)).toBeTruthy();
  const values = JSON.parse(screen.getByRole("status").textContent!);
  expect(values[1]).toMatchObject({ id: "one", question: "Why attend?", description: "Retained description" });
  expect(values[2].response).toBe("file_upload");
});
it("renders submitted questions as summaries without editing controls", () => {
  render(<Form locked />);
  expect(screen.getByText(/locked because/)).toBeTruthy();
  expect(screen.getByText("Why?")).toBeTruthy();
  expect(screen.getByText("1")).toBeTruthy();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
it("moves question errors out of the way when indices change", () => {
  const { result } = renderHook(() => useApplicationQuestions(() => {}, questions));
  act(() => result.current.setQuestionErrors({ 0: "Required" }));
  act(() => result.current.moveApplicationQuestion(0, 1));
  expect(result.current.applicationTemplate.map(q => q.id)).toEqual(["two", "one"]);
  expect(result.current.questionErrors).toEqual({});
});

it("keeps Required choices independent and allows either to be turned off", () => {
  render(<Form />);
  const boxes = screen.getAllByRole("checkbox", { name: "Required" }) as HTMLInputElement[];
  expect(boxes.map(box => box.checked)).toEqual([true, false]);
  fireEvent.click(boxes[1]);
  expect(boxes.map(box => box.checked)).toEqual([true, true]);
  fireEvent.click(boxes[0]);
  expect(boxes.map(box => box.checked)).toEqual([false, true]);
  fireEvent.click(boxes[1]);
  expect(boxes.map(box => box.checked)).toEqual([false, false]);
});
