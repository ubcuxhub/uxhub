// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChartContainer } from "./chart";

vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: ({ children, initialDimension }: { children: React.ReactNode; initialDimension: { width: number; height: number } }) =>
    <div data-testid="responsive" data-initial-width={initialDimension.width} data-initial-height={initialDimension.height}>{children}</div>,
}));
afterEach(cleanup);

it("preserves responsive sizing by default and accepts initial dimensions", () => {
  const { rerender } = render(<ChartContainer config={{}}><svg aria-label="Chart" /></ChartContainer>);
  expect(screen.getByTestId("responsive").dataset.initialWidth).toBe("320");
  expect(screen.getByTestId("responsive").dataset.initialHeight).toBe("200");
  rerender(<ChartContainer config={{}} initialDimension={{ width: 200, height: 100 }}><svg aria-label="Chart" /></ChartContainer>);
  expect(screen.getByTestId("responsive").dataset.initialWidth).toBe("200");
  expect(screen.getByTestId("responsive").dataset.initialHeight).toBe("100");
});

it("renders fixed children directly while retaining theme configuration", () => {
  const { container } = render(<ChartContainer responsive={false} config={{ count: { theme: { light: "var(--primary)", dark: "var(--foreground)" } } }}>
    <svg aria-label="Fixed chart" width={85} height={85} />
  </ChartContainer>);
  expect(screen.queryByTestId("responsive")).toBeNull();
  expect(screen.getByLabelText("Fixed chart").parentElement).toBe(container.querySelector('[data-slot="chart"]'));
  expect(container.querySelector("style")?.textContent).toContain("--color-count: var(--primary)");
  expect(container.querySelector("style")?.textContent).toContain("--color-count: var(--foreground)");
});
