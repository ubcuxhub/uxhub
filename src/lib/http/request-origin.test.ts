import { describe, expect, it } from "vitest";

import { getHeadersOrigin, getRequestOrigin } from "./request-origin";

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("getRequestOrigin", () => {
  it("prefers the Host header over the server-resolved request URL", () => {
    const request = makeRequest("http://localhost:3000/auth/callback", {
      host: "127.0.0.1:3000",
    });

    expect(getRequestOrigin(request)).toBe("http://127.0.0.1:3000");
  });

  it("prefers forwarded headers when a proxy sets them", () => {
    const request = makeRequest("http://10.0.0.4:3000/auth/callback", {
      host: "10.0.0.4:3000",
      "x-forwarded-host": "uxhub.ca",
      "x-forwarded-proto": "https",
    });

    expect(getRequestOrigin(request)).toBe("https://uxhub.ca");
  });

  it("uses the first entry of a forwarded proxy chain", () => {
    const request = makeRequest("http://10.0.0.4:3000/auth/callback", {
      "x-forwarded-host": "uxhub.ca, internal.vercel.app",
      "x-forwarded-proto": "https, http",
    });

    expect(getRequestOrigin(request)).toBe("https://uxhub.ca");
  });

  it("keeps the request protocol when only the host is forwarded", () => {
    const request = makeRequest("http://localhost:3000/auth/callback", {
      "x-forwarded-host": "127.0.0.1:3000",
    });

    expect(getRequestOrigin(request)).toBe("http://127.0.0.1:3000");
  });

  it("falls back to the request URL origin without host headers", () => {
    const request = makeRequest("https://uxhub.ca/auth/callback");
    request.headers.delete("host");

    expect(getRequestOrigin(request)).toBe("https://uxhub.ca");
  });
});

describe("getHeadersOrigin", () => {
  it("prefers the forwarded host and protocol", () => {
    const headers = new Headers({
      host: "internal:3000",
      "x-forwarded-host": "ubcuxhub.ca, proxy.internal",
      "x-forwarded-proto": "https",
    });
    expect(getHeadersOrigin(headers)).toBe("https://ubcuxhub.ca");
  });

  it("uses the first entry of a forwarded protocol chain", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "uxhub.ca, internal.vercel.app",
      "x-forwarded-proto": "https, http",
    });
    expect(getHeadersOrigin(headers)).toBe("https://uxhub.ca");
  });

  it("assumes http for a local host and https otherwise", () => {
    expect(getHeadersOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(getHeadersOrigin(new Headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
    expect(getHeadersOrigin(new Headers({ host: "preview.vercel.app" }))).toBe("https://preview.vercel.app");
  });

  it("is null without a host", () => {
    expect(getHeadersOrigin(new Headers())).toBeNull();
  });
});
