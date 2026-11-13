import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAutosave, type AutosaveOptions, type WriteOutcome } from "./autosave";

interface Call {
  payload: string;
  settle: (outcome: WriteOutcome) => void;
  fail: () => void;
}

/**
 * One text answer: `value` is what the form holds, `saved` what the server
 * does. Each write waits until the test settles it.
 */
function setUp(options: Partial<AutosaveOptions<string>> = {}) {
  const store = { value: "", saved: "" };
  const calls: Call[] = [];
  const states: string[] = [];
  const autosave = createAutosave<string>({
    read: () => (store.value === store.saved ? null : store.value),
    write: (payload) =>
      new Promise<WriteOutcome>((resolve, reject) => {
        calls.push({
          payload,
          settle: (outcome) => {
            if (outcome === "saved") store.saved = payload;
            resolve(outcome);
          },
          fail: () => reject(new Error("Failed to fetch")),
        });
      }),
    onState: (state) => states.push(state.kind),
    now: () => 42,
    ...options,
  });
  const edit = (value: string, delayMs?: number) => {
    store.value = value;
    autosave.schedule(delayMs);
  };
  return { store, calls, states, autosave, edit };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosave", () => {
  it("waits for a pause in typing, then saves the latest text once", async () => {
    const { calls, autosave, edit } = setUp();

    edit("H");
    await tick(500);
    edit("Hi");
    await tick(999);
    expect(calls).toHaveLength(0);
    expect(autosave.state()).toEqual({ kind: "pending" });

    await tick(1);
    expect(calls.map((call) => call.payload)).toEqual(["Hi"]);
    expect(autosave.state()).toEqual({ kind: "saving" });

    calls[0].settle("saved");
    await tick();
    expect(autosave.state()).toEqual({ kind: "saved", at: 42 });
  });

  it("saves a choice at once", async () => {
    const { calls, edit } = setUp();
    edit("Design", 0);
    await tick();
    expect(calls.map((call) => call.payload)).toEqual(["Design"]);
  });

  it("does nothing when nothing changed since the last save", async () => {
    const { calls, states, autosave, edit } = setUp();

    edit("");
    await tick(2000);
    expect(calls).toHaveLength(0);
    expect(states).toEqual([]);

    edit("x");
    edit("");
    await tick(2000);
    expect(calls).toHaveLength(0);
    expect(autosave.state()).toEqual({ kind: "idle" });
  });

  it("never has two saves in flight, and saves an edit made during one after it", async () => {
    const { store, calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    edit("ab", 0);
    await tick(5000);
    expect(calls).toHaveLength(1);
    expect(autosave.state()).toEqual({ kind: "saving" });

    calls[0].settle("saved");
    await tick();
    // The first save's result doesn't overwrite the newer edit.
    expect(store).toEqual({ value: "ab", saved: "a" });
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).toBe("ab");

    calls[1].settle("saved");
    await tick();
    expect(store.saved).toBe("ab");
    expect(autosave.state()).toEqual({ kind: "saved", at: 42 });
  });

  it("debounces a typing edit queued behind a save in flight", async () => {
    const { calls, edit } = setUp();

    edit("a", 0);
    await tick();
    edit("ab");
    calls[0].settle("saved");
    await tick(999);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
  });

  it("retries a transient failure with backoff, then shows the failure", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    calls[0].fail();
    await tick(999);
    expect(calls).toHaveLength(1);
    expect(autosave.state()).toEqual({ kind: "saving" });

    await tick(1);
    expect(calls).toHaveLength(2);
    calls[1].settle("transient");
    await tick(2999);
    expect(calls).toHaveLength(2);
    await tick(1);
    expect(calls).toHaveLength(3);

    calls[2].fail();
    await tick();
    expect(autosave.state()).toEqual({ kind: "failed" });
    await tick(60_000);
    expect(calls).toHaveLength(3);

    autosave.retry();
    await tick();
    expect(calls).toHaveLength(4);
    calls[3].settle("saved");
    await tick();
    expect(autosave.state()).toEqual({ kind: "saved", at: 42 });
  });

  it("retries with the answers as they are by then", async () => {
    const { calls, edit } = setUp();

    edit("a", 0);
    await tick();
    calls[0].fail();
    await tick();
    edit("ab");
    await tick(1000);
    expect(calls.map((call) => call.payload)).toEqual(["a", "ab"]);
  });

  it("tries again on the next edit after failing", async () => {
    const { calls, autosave, edit } = setUp({ retryDelaysMs: [] });

    edit("a", 0);
    await tick();
    calls[0].fail();
    await tick();
    expect(autosave.state()).toEqual({ kind: "failed" });

    edit("ab");
    expect(autosave.state()).toEqual({ kind: "pending" });
    await tick(1000);
    expect(calls).toHaveLength(2);
  });

  it("doesn't retry answers the server refused as invalid", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    calls[0].settle("invalid");
    await tick(10_000);
    expect(calls).toHaveLength(1);
    expect(autosave.state()).toEqual({ kind: "failed" });
  });

  it("stops for good on a refusal", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    edit("ab");
    calls[0].settle("refused");
    await tick(10_000);
    expect(autosave.state()).toEqual({ kind: "stopped" });

    edit("abc", 0);
    autosave.retry();
    await tick(10_000);
    expect(calls).toHaveLength(1);
    expect(await autosave.flush()).toEqual({ kind: "stopped" });
  });

  it("flushes a waiting edit at once and resolves when it is saved", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a");
    const flushed = autosave.flush();
    await tick();
    expect(calls.map((call) => call.payload)).toEqual(["a"]);

    calls[0].settle("saved");
    await expect(flushed).resolves.toEqual({ kind: "saved", at: 42 });
    await tick(5000);
    expect(calls).toHaveLength(1);
  });

  it("flushes after the save in flight, including an edit made during it", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    edit("ab");
    let done = false;
    const flushed = autosave.flush().then((state) => {
      done = true;
      return state;
    });

    calls[0].settle("saved");
    await tick();
    expect(done).toBe(false);
    expect(calls.map((call) => call.payload)).toEqual(["a", "ab"]);

    calls[1].settle("saved");
    await expect(flushed).resolves.toEqual({ kind: "saved", at: 42 });
  });

  it("flush skips a retry wait", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    calls[0].fail();
    await tick();
    const flushed = autosave.flush();
    await tick();
    expect(calls).toHaveLength(2);
    calls[1].settle("saved");
    await expect(flushed).resolves.toEqual({ kind: "saved", at: 42 });
  });

  it("flush with nothing to save resolves at once", async () => {
    const { calls, autosave } = setUp();
    await expect(autosave.flush()).resolves.toEqual({ kind: "idle" });
    expect(calls).toHaveLength(0);
  });

  it("runs an exclusive task with no save beside it, then saves what changed", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a");
    let finishUpload = () => {};
    const upload = autosave.exclusive(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = () => resolve("uploaded");
        })
    );
    await tick(5000);
    edit("ab", 0);
    await tick(5000);
    expect(calls).toHaveLength(0);
    expect(autosave.state()).toEqual({ kind: "pending" });

    finishUpload();
    await expect(upload).resolves.toBe("uploaded");
    await tick();
    expect(calls.map((call) => call.payload)).toEqual(["ab"]);
  });

  it("waits for the save in flight before an exclusive task", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    const task = vi.fn(async () => "submitted");
    const submitted = autosave.exclusive(task);
    await tick();
    expect(task).not.toHaveBeenCalled();

    calls[0].settle("saved");
    await expect(submitted).resolves.toBe("submitted");
    expect(task).toHaveBeenCalledOnce();
  });

  it("pause holds saves until resume, after the one in flight", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a", 0);
    await tick();
    let paused = false;
    const pausing = autosave.pause().then(() => {
      paused = true;
    });
    edit("ab", 0);
    await tick();
    expect(paused).toBe(false);

    calls[0].settle("saved");
    await pausing;
    await tick(5000);
    expect(calls).toHaveLength(1);

    autosave.resume();
    await tick();
    expect(calls.map((call) => call.payload)).toEqual(["a", "ab"]);
  });

  it("stop cancels a waiting save", async () => {
    const { calls, autosave, edit } = setUp();

    edit("a");
    autosave.stop();
    await tick(5000);
    expect(calls).toHaveLength(0);
    expect(autosave.state()).toEqual({ kind: "stopped" });
  });
});
