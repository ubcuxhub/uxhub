import { parseTarget, type SeedTarget } from "../seed/lib/targets.ts";

export type PaymentSmokeCommand = "seed" | "status" | "unseed";

export interface PaymentSmokeOptions {
  command: PaymentSmokeCommand;
  dryRun: boolean;
  target: SeedTarget;
}

const COMMANDS = new Set<PaymentSmokeCommand>(["seed", "status", "unseed"]);

export function parseArgs(argv: string[]): PaymentSmokeOptions {
  let command: PaymentSmokeCommand | null = null;
  let dryRun = false;
  let target: SeedTarget | null = null;

  for (const arg of argv) {
    if (arg === "--") continue;

    if (COMMANDS.has(arg as PaymentSmokeCommand)) {
      if (command) {
        throw new Error(`Only one command is allowed; received "${command}" and "${arg}".`);
      }
      command = arg as PaymentSmokeCommand;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--target=")) {
      if (target) throw new Error("--target can only be provided once.");
      target = parseTarget(arg.slice("--target=".length).trim());
      continue;
    }

    throw new Error(
      `Unknown argument "${arg}". Usage: payment-smoke <seed|status|unseed> --target=<local|prod> [--dry-run]`,
    );
  }

  if (!command) {
    throw new Error("A command is required: seed, status, or unseed.");
  }
  if (!target) {
    throw new Error("An explicit --target=<local|prod> is required.");
  }
  if (command === "status" && dryRun) {
    throw new Error("--dry-run is not valid for the read-only status command.");
  }

  return { command, dryRun, target };
}
