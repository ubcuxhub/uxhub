// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pagination, getPageSummary } from "./pagination";

afterEach(cleanup);

describe("getPageSummary", () => {
  it("reads the first page", () => {
    expect(getPageSummary(1, 10, 48)).toMatchObject({
      from: 1,
      to: 10,
      pageCount: 5,
      label: "Showing 1–10 of 48 · Page 1 of 5",
    });
  });

  it("reads a middle page", () => {
    expect(getPageSummary(3, 10, 48).label).toBe("Showing 21–30 of 48 · Page 3 of 5");
  });

  it("ends the last page at the total", () => {
    expect(getPageSummary(5, 10, 48).label).toBe("Showing 41–48 of 48 · Page 5 of 5");
  });

  it("handles an empty list", () => {
    expect(getPageSummary(1, 10, 0)).toMatchObject({
      from: 0,
      to: 0,
      pageCount: 1,
      label: "Showing 0 of 0 · Page 1 of 1",
    });
  });

  it("clamps the page to the last and first", () => {
    expect(getPageSummary(99, 10, 48).page).toBe(5);
    expect(getPageSummary(0, 10, 48).page).toBe(1);
    expect(getPageSummary(-3, 10, 48).page).toBe(1);
  });
});

describe("Pagination", () => {
  it("renders nothing without results", () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={0} onPageChange={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("is a labelled nav with a polite summary", () => {
    render(<Pagination page={1} pageSize={10} total={48} onPageChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav.querySelector("[aria-live=polite]")?.textContent).toBe(
      "Showing 1–10 of 48 · Page 1 of 5",
    );
  });

  it("disables the ends and steps in between", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={48} onPageChange={onPageChange} />,
    );
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(
      <Pagination page={5} pageSize={10} total={48} onPageChange={onPageChange} />,
    );
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it("links to the neighbouring pages in href mode", () => {
    render(
      <Pagination
        page={2}
        pageSize={10}
        total={48}
        getPageHref={(p) => `?page=${p}`}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Previous page" }).getAttribute("href"),
    ).toBe("?page=1");
    expect(
      screen.getByRole("link", { name: "Next page" }).getAttribute("href"),
    ).toBe("?page=3");
  });
});
