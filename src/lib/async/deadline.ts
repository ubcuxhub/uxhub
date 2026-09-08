export const ASYNC_DEADLINES = {
  userAction: 25_000,
  checkout: 90_000,
  confirmationPolling: 120_000,
} as const;

export class AsyncTimeoutError extends Error {
  readonly code = "ASYNC_TIMEOUT";
  readonly timeoutMs: number;

  constructor(timeoutMs: number, operation = "Request") {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = "AsyncTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

interface DeadlineOptions {
  operation?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Bounds an asynchronous operation and aborts cooperative work when its
 * deadline expires. The returned promise settles only once, so a late result
 * from a non-cooperative API is ignored.
 */
export async function withDeadline<T>(
  task: (signal: AbortSignal) => Promise<T>,
  {
    operation = "Request",
    signal,
    timeoutMs = ASYNC_DEADLINES.userAction,
  }: DeadlineOptions = {},
): Promise<T> {
  const controller = new AbortController();

  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new AsyncTimeoutError(timeoutMs, operation);

  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  const callerAbort = new Promise<never>((_, reject) => {
    const rejectCallerAbort = () => {
      if (controller.signal.reason !== timeoutError) {
        reject(
          controller.signal.reason ??
            new DOMException("The operation was aborted.", "AbortError"),
        );
      }
    };

    if (controller.signal.aborted) rejectCallerAbort();
    else {
      controller.signal.addEventListener("abort", rejectCallerAbort, {
        once: true,
      });
    }
  });

  const taskPromise = Promise.resolve().then(() => task(controller.signal));
  // A late rejection after the deadline must not become an unhandled rejection.
  void taskPromise.catch(() => undefined);

  try {
    return await Promise.race([taskPromise, deadline, callerAbort]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function isAsyncTimeoutError(error: unknown): error is AsyncTimeoutError {
  return error instanceof AsyncTimeoutError;
}

export function getAsyncErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Check your connection and try again.",
) {
  if (isAsyncTimeoutError(error)) {
    return "This is taking longer than expected. Check your connection and try again.";
  }

  return fallback;
}
