// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApplicationResponseCard } from "./ApplicationResponseCard";

afterEach(cleanup);

describe("ApplicationResponseCard", () => {
  it("lists a checkbox answer stored as JSON, commas and all", () => {
    render(
      <ApplicationResponseCard
        question="Pick any"
        response='["Research","Design, UI"]'
        responseType="checkbox"
      />
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Research",
      "Design, UI",
    ]);
  });

  it("lists a legacy comma-joined checkbox answer", () => {
    render(
      <ApplicationResponseCard
        question="Pick any"
        response="Research, Design, UI"
        responseType="checkbox"
        responseOptions={["Research", "Design, UI"]}
      />
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Research",
      "Design, UI",
    ]);
  });

  it("links a file answer by its name", () => {
    render(
      <ApplicationResponseCard
        question="Resume"
        response="user/application/question/Resume.pdf"
        responseType="file_upload"
        fileUrl="https://example.test/signed"
      />
    );

    expect(screen.getByRole("link", { name: "Resume.pdf" }).getAttribute("href")).toBe(
      "https://example.test/signed"
    );
  });

  it("says when nothing was answered", () => {
    render(
      <ApplicationResponseCard question="Pick any" response="[]" responseType="checkbox" />
    );

    expect(screen.getByText("No response provided")).toBeTruthy();
  });
});
