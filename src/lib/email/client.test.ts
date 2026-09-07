import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const send = vi.fn().mockResolvedValue({ error: null });

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { sendEmail } = await import("./client");

describe("sendEmail", () => {
  it.each([
    ['"UX Hub <noreply@ubcuxhub.ca>"', "UX Hub <noreply@ubcuxhub.ca>"],
    ["UX Hub <noreply@ubcuxhub.ca>", "UX Hub <noreply@ubcuxhub.ca>"],
    ["  UX Hub <noreply@ubcuxhub.ca>  ", "UX Hub <noreply@ubcuxhub.ca>"],
  ])("sends from %s as %s", async (configured, expected) => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", configured);
    send.mockClear();

    await sendEmail({ html: "<p>hi</p>", subject: "Subject", to: "a@b.com" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: expected })
    );
  });

  it("falls back when EMAIL_FROM is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "");
    send.mockClear();

    await sendEmail({ html: "<p>hi</p>", subject: "Subject", to: "a@b.com" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "UX Hub <onboarding@resend.dev>" })
    );
  });
});
