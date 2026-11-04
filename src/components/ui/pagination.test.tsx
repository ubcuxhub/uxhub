// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pagination, clampPage, getPageSummary } from "./pagination";

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

  it("announces the summary when the page changes, not on mount or as results change", () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={48} onPageChange={() => {}} />,
    );
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    const live = nav.querySelectorAll("[aria-live]");
    // One live region, silent until something is paged.
    expect(live).toHaveLength(1);
    expect(live[0].getAttribute("aria-live")).toBe("polite");
    expect(live[0].textContent).toBe("");

    // Typing narrows the results: still silent (SearchField has its own count).
    rerender(<Pagination page={1} pageSize={10} total={7} onPageChange={() => {}} />);
    expect(live[0].textContent).toBe("");

    rerender(<Pagination page={2} pageSize={5} total={7} onPageChange={() => {}} />);
    expect(live[0].textContent).toBe("Showing 6–7 of 7 · Page 2 of 2");

    // More typing on the same page leaves the last announcement alone.
    rerender(<Pagination page={2} pageSize={5} total={9} onPageChange={() => {}} />);
    expect(live[0].textContent).toBe("Showing 6–7 of 7 · Page 2 of 2");
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

  describe("focus at the ends", () => {
    function Controlled({ start, total = 48 }: { start: number; total?: number }) {
      const [page, setPage] = useState(start);
      return <Pagination page={page} pageSize={10} total={total} onPageChange={setPage} />;
    }

    it("moves from Next to Previous when the keyboard reaches the last page", () => {
      render(<Controlled start={4} />);
      const next = screen.getByRole("button", { name: "Next page" });
      next.focus();
      fireEvent.click(next, { detail: 0 });
      expect((next as HTMLButtonElement).disabled).toBe(true);
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Previous page" }),
      );
    });

    it("moves from Previous to Next when the keyboard reaches the first page", () => {
      render(<Controlled start={2} />);
      const prev = screen.getByRole("button", { name: "Previous page" });
      prev.focus();
      fireEvent.click(prev, { detail: 0 });
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Next page" }),
      );
    });

    it("leaves focus alone in the middle, and after a pointer click", () => {
      render(<Controlled start={3} />);
      const next = screen.getByRole("button", { name: "Next page" });
      next.focus();
      fireEvent.click(next, { detail: 0 });
      expect(document.activeElement).toBe(next);

      fireEvent.click(next, { detail: 1 });
      expect((next as HTMLButtonElement).disabled).toBe(true);
      expect(document.activeElement).not.toBe(
        screen.getByRole("button", { name: "Previous page" }),
      );
    });

    it("keeps focus in the pair in href mode, where the link is swapped for a button", () => {
      const href = (p: number) => `?page=${p}`;
      const { rerender } = render(
        <Pagination page={4} pageSize={10} total={48} getPageHref={href} />,
      );
      const next = screen.getByRole("link", { name: "Next page" });
      next.addEventListener("click", (event) => event.preventDefault());
      next.focus();
      fireEvent.click(next, { detail: 0 });
      // The server renders the last page and the link becomes a disabled button.
      rerender(<Pagination page={5} pageSize={10} total={48} getPageHref={href} />);
      expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "Previous page" }),
      );
    });
  });

  describe("clamping", () => {
    it("clampPage keeps a page inside the list", () => {
      expect(clampPage(99, 10, 48)).toBe(5);
      expect(clampPage(0, 10, 48)).toBe(1);
      expect(clampPage(Number.NaN, 10, 48)).toBe(1);
      expect(clampPage(2.9, 10, 48)).toBe(2);
      expect(clampPage(3, 10, 0)).toBe(1);
    });

    it("reports the clamped page when the page it was given is out of range", () => {
      const onPageChange = vi.fn();
      const { rerender } = render(
        <Pagination page={99} pageSize={10} total={48} onPageChange={onPageChange} />,
      );
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(5);

      // A page in range is never reported back.
      onPageChange.mockClear();
      rerender(<Pagination page={5} pageSize={10} total={48} onPageChange={onPageChange} />);
      expect(onPageChange).not.toHaveBeenCalled();

      // The list shrinks under the current page.
      rerender(<Pagination page={5} pageSize={10} total={12} onPageChange={onPageChange} />);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });
});
