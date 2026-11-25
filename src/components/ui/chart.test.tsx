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

// Both layouts must generate the same selectors used by the app theme controls.
it.each([true, false])("targets data-theme for theme colors (responsive=%s)", (responsive) => {
  const { container } = render(<ChartContainer id="themed" responsive={responsive} config={{ count: { theme: { light: "#111111", dark: "#eeeeee" } } }}>
    <svg aria-label="Themed chart" />
  </ChartContainer>);
  const css = container.querySelector("style")!.textContent!;
  expect(css).toContain('[data-theme="dark"] [data-chart=chart-themed] {\n  --color-count: #eeeeee;');
  expect(css).toContain('[data-chart=chart-themed] {\n  --color-count: #111111;');
  expect(css).not.toContain(".dark");
  expect(Boolean(screen.queryByTestId("responsive"))).toBe(responsive);
});
