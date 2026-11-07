/**
 * The application form's autosave, kept free of React so its timing can be
 * tested with fake timers. One controller per form:
 *
 * - `schedule()` after every change: text waits for a pause (`delayMs`),
 *   choices pass 0 to save at once.
 * - Saves run one at a time. A change made while one is in flight is saved
 *   after it, so a slow response never lands on top of newer edits.
 * - Each save sends what `read()` returns at that moment (only what differs
 *   from the last save, or null when nothing does), so a save that finds
 *   nothing to do is skipped.
 * - A transient failure is retried after each of `retryDelaysMs`, then the
 *   state turns `failed` until `retry()` or the next change. A refusal (the
 *   window closed, the application was submitted) stops autosave for good.
 */

/** What one write came to. */
export type WriteOutcome =
  /** The payload is stored. */
  | "saved"
  /** Network or server trouble: worth retrying. */
  | "transient"
  /** The answers themselves were refused; retrying the same ones won't help. */
  | "invalid"
  /** Saving can never succeed again (the window closed, already submitted). */
  | "refused";

export type AutosaveState =
  /** Nothing saved yet in this visit, and nothing waiting. */
  | { kind: "idle" }
  /** A change is waiting for its debounce or for the save in flight. */
  | { kind: "pending" }
  | { kind: "saving" }
  /** Everything is saved; `at` is when the last save finished (ms). */
  | { kind: "saved"; at: number }
  /** The last save failed and changes are still unsaved. */
  | { kind: "failed" }
  /** Refused: autosave won't try again. */
  | { kind: "stopped" };

export interface AutosaveHandlers<Payload> {
  /** What still needs saving, or null when everything is saved. */
  read: () => Payload | null;
  /** Saves `payload`. Should record it as saved before resolving `saved`. */
  write: (payload: Payload) => Promise<WriteOutcome>;
}

/** `read` and `write` may come later, through `configure`. */
export interface AutosaveOptions<Payload> extends Partial<AutosaveHandlers<Payload>> {
  onState?: (state: AutosaveState) => void;
  /** How long a change waits for the next one. Default 1000 ms. */
  delayMs?: number;
  /** The waits before each retry of a transient failure. Default 1 s, then 3 s. */
  retryDelaysMs?: readonly number[];
  now?: () => number;
}

export interface Autosave<Payload> {
  state: () => AutosaveState;
  /** Sets `read` and `write`, for a caller whose closures change. */
  configure: (handlers: AutosaveHandlers<Payload>) => void;
  /** Saves after `delayMs` (the debounce by default) with no further change. */
  schedule: (delayMs?: number) => void;
  /**
   * Saves anything waiting now, after the save in flight, skipping any
   * retry wait. Resolves with the state it ends in.
   */
  flush: () => Promise<AutosaveState>;
  /** Saves again now, after a failure. */
  retry: () => void;
  /**
   * Runs `task` (another write, such as a file upload or Submit) with no save
   * in flight beside it; changes made meanwhile are saved after it.
   */
  exclusive: <T>(task: () => Promise<T>) => Promise<T>;
  /** Holds every save until `resume()`; resolves once none is in flight. */
  pause: () => Promise<void>;
  /** Lets saves run again, and saves anything that changed meanwhile. */
  resume: () => void;
  /** Stops for good (the application was submitted or deleted). */
  stop: () => void;
}

export const AUTOSAVE_DELAY_MS = 1000;
export const AUTOSAVE_RETRY_DELAYS_MS = [1000, 3000] as const;

export function createAutosave<Payload>(
  options: AutosaveOptions<Payload> = {}
): Autosave<Payload> {
  const delayMs = options.delayMs ?? AUTOSAVE_DELAY_MS;
  const retryDelaysMs = options.retryDelaysMs ?? AUTOSAVE_RETRY_DELAYS_MS;
  const now = options.now ?? Date.now;

  let handlers: AutosaveHandlers<Payload> = {
    read: options.read ?? (() => null),
    write: options.write ?? (async () => "transient"),
  };
  let state: AutosaveState = { kind: "idle" };
  let lastSavedAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The save or exclusive task in flight; never rejects. */
  let busy: Promise<void> | null = null;
  /** The delay a change asked for while `busy`; it is scheduled afterwards. */
  let queued: number | null = null;
  /** Ends a retry wait early. */
  let wake: (() => void) | null = null;
  let paused = false;
  let stopped = false;

  const set = (next: AutosaveState) => {
    if (
      next.kind === state.kind &&
      (next.kind !== "saved" || (state.kind === "saved" && state.at === next.at))
    ) {
      return;
    }
    state = next;
    options.onState?.(next);
  };

  /** Back to rest: saved if anything was, idle otherwise. */
  const rest = () =>
    set(lastSavedAt === null ? { kind: "idle" } : { kind: "saved", at: lastSavedAt });

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(done, ms);
      function done() {
        clearTimeout(id);
        wake = null;
        resolve();
      }
      wake = done;
    });

  /** Runs `task` as the one thing in flight, then schedules what queued. */
  const hold = <T>(task: () => Promise<T>): Promise<T> => {
    let release = () => {};
    busy = new Promise<void>((resolve) => {
      release = resolve;
    });
    return (async () => {
      try {
        return await task();
      } finally {
        busy = null;
        release();
        const again = queued;
        queued = null;
        if (again !== null) schedule(again);
      }
    })();
  };

  // Each wait for `busy` below is inline, so the check that it is clear and
  // the `hold` that takes it run in the same tick.
  async function save(): Promise<void> {
    while (busy) await busy;
    if (stopped || paused) return;
    if (handlers.read() === null) {
      rest();
      return;
    }

    await hold(async () => {
      set({ kind: "saving" });
      for (let attempt = 0; ; attempt++) {
        const payload = handlers.read();
        if (payload === null) {
          rest();
          return;
        }

        let outcome: WriteOutcome;
        try {
          outcome = await handlers.write(payload);
        } catch {
          outcome = "transient";
        }
        if (stopped) return;

        if (outcome === "saved") {
          lastSavedAt = now();
          rest();
          return;
        }
        if (outcome === "refused") {
          stopped = true;
          clearTimer();
          queued = null;
          set({ kind: "stopped" });
          return;
        }
        if (outcome === "transient" && attempt < retryDelaysMs.length && !paused) {
          await sleep(retryDelaysMs[attempt]);
          if (stopped) return;
          if (!paused) continue;
        }
        set({ kind: "failed" });
        return;
      }
    });
  }

  function schedule(ms = delayMs) {
    if (stopped || paused) return;
    clearTimer();
    if (busy) {
      queued = Math.min(queued ?? ms, ms);
      if (state.kind !== "saving") set({ kind: "pending" });
      return;
    }
    if (handlers.read() === null) {
      if (state.kind === "pending" || state.kind === "failed") rest();
      return;
    }
    set({ kind: "pending" });
    timer = setTimeout(() => {
      timer = null;
      void save();
    }, ms);
  }

  async function flush(): Promise<AutosaveState> {
    clearTimer();
    wake?.();
    while (busy) {
      queued = null;
      await busy;
      clearTimer();
    }
    if (!stopped && !paused && handlers.read() !== null) await save();
    return state;
  }

  return {
    state: () => state,
    configure(next) {
      handlers = next;
    },
    schedule,
    flush,
    retry() {
      if (stopped || paused) return;
      clearTimer();
      if (busy) {
        queued = 0;
        wake?.();
        return;
      }
      void save();
    },
    async exclusive(task) {
      if (timer !== null) {
        clearTimer();
        queued = Math.min(queued ?? 0, 0);
      }
      wake?.();
      while (busy) await busy;
      return hold(task);
    },
    async pause() {
      paused = true;
      clearTimer();
      wake?.();
      while (busy) await busy;
    },
    resume() {
      paused = false;
      if (handlers.read() !== null) schedule(0);
      else if (state.kind === "pending") rest();
    },
    stop() {
      stopped = true;
      clearTimer();
      queued = null;
      wake?.();
      set({ kind: "stopped" });
    },
  };
}
