import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubClientEvent, scrubServerEvent, stripUrl } from "./sentry";

function errorEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: "PostgrestError",
          value:
            'duplicate key value violates unique constraint "users_email_key" Key (email)=(student@example.com)',
        },
      ],
    },
    request: {
      method: "POST",
      url: "https://ubcuxhub.ca/auth/callback?code=secret-code#frag",
      data: { email: "student@example.com" },
      cookies: { "sb-access-token": "token" },
      query_string: "code=secret-code",
      headers: { "user-agent": "Safari", cookie: "sb-access-token=token" },
    },
    contexts: { nextjs: { request_path: "/auth/callback?code=secret-code" } },
    breadcrumbs: [
      { category: "navigation", data: { from: "/portal?a=1", to: "/auth/callback?code=x" } },
      { category: "fetch", data: { url: "https://api.example.com/x?token=y", method: "GET" } },
      { category: "console", message: "student@example.com" },
    ],
    ...overrides,
  };
}

describe("stripUrl", () => {
  it("drops the query string and hash", () => {
    expect(stripUrl("https://a.ca/x?code=1#y")).toBe("https://a.ca/x");
    expect(stripUrl("/portal#settings/profile")).toBe("/portal");
    expect(stripUrl("/portal")).toBe("/portal");
  });
});

describe("scrubServerEvent", () => {
  it("replaces the exception message with the type and database code", () => {
    const event = scrubServerEvent(errorEvent(), {
      originalException: { code: "23505", message: "row data" },
    });

    expect(event.exception?.values?.[0].value).toBe("PostgrestError 23505");
  });

  it("keeps only the type when there is no code", () => {
    const event = scrubServerEvent(
      errorEvent({
        exception: {
          values: [
            { type: "TypeError", value: "inner student@example.com" },
            { type: "Error", value: "outer student@example.com" },
          ],
        },
      }),
      { originalException: new Error("outer") },
    );

    expect(event.exception?.values?.map((value) => value.value)).toEqual([
      "TypeError",
      "Error",
    ]);
  });

  it("removes the request body, cookies, query string, and other headers", () => {
    const event = scrubServerEvent(errorEvent(), {});

    expect(event.request).toEqual({
      method: "POST",
      url: "https://ubcuxhub.ca/auth/callback",
      headers: { "user-agent": "Safari" },
    });
    expect(event.contexts?.nextjs?.request_path).toBe("/auth/callback");
  });

  it("drops console breadcrumbs and strips URLs from the rest", () => {
    const event = scrubServerEvent(errorEvent(), {});

    expect(event.breadcrumbs).toEqual([
      { category: "navigation", data: { from: "/portal", to: "/auth/callback" } },
      { category: "fetch", data: { url: "https://api.example.com/x", method: "GET" } },
    ]);
  });

  it("leaves no personal data anywhere in the event", () => {
    const event = scrubServerEvent(errorEvent(), {
      originalException: { code: "23505" },
    });

    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("student@example.com");
    expect(serialized).not.toContain("secret-code");
    expect(serialized).not.toContain("token");
  });
});

describe("scrubClientEvent", () => {
  it("keeps the exception message, which describes the bug", () => {
    const event = scrubClientEvent(
      errorEvent({
        exception: {
          values: [
            { type: "TypeError", value: "Cannot read properties of undefined" },
          ],
        },
      }),
    );

    expect(event.exception?.values?.[0].value).toBe(
      "Cannot read properties of undefined",
    );
  });

  it("strips the request and breadcrumb URLs", () => {
    const event = scrubClientEvent(errorEvent());

    expect(event.request?.url).toBe("https://ubcuxhub.ca/auth/callback");
    expect(event.request?.data).toBeUndefined();
    expect(event.breadcrumbs?.[1].data?.url).toBe("https://api.example.com/x");
  });
});
