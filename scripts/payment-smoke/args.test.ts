import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";

describe("payment-smoke arguments", () => {
  it("parses each command with an explicit target", () => {
    expect(parseArgs(["seed", "--target=prod", "--dry-run"])).toEqual({
      command: "seed",
      dryRun: true,
      target: "prod",
    });
    expect(parseArgs(["status", "--target=local"])).toEqual({
      command: "status",
      dryRun: false,
      target: "local",
    });
    expect(parseArgs(["unseed", "--target=prod"])).toEqual({
      command: "unseed",
      dryRun: false,
      target: "prod",
    });
  });

  it("requires an explicit target and one known command", () => {
    expect(() => parseArgs(["seed"])).toThrow(/explicit --target/);
    expect(() => parseArgs(["--target=prod"])).toThrow(/command is required/);
    expect(() => parseArgs(["remove", "--target=prod"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["seed", "status", "--target=prod"])).toThrow(
      /Only one command/,
    );
  });

  it("only accepts dry runs for mutating commands", () => {
    expect(() => parseArgs(["status", "--target=prod", "--dry-run"])).toThrow(
      /not valid.*status/,
    );
  });

  it("inherits the seed target validation", () => {
    expect(() => parseArgs(["seed", "--target=staging"])).toThrow(
      /Unknown --target/,
    );
  });
});
