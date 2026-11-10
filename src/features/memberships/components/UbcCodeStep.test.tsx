// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UbcSendResult, UbcVerifyResult } from "@/features/memberships/lib/ubc-verification";
import {
  formatCountdown,
  stateAfterSend,
  UbcCodeStep,
  type UbcCodeClient,
  type UbcCodeStart,
} from "./UbcCodeStep";

const NOW = new Date("2026-11-10T18:00:00.000Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();
const SENT: UbcSendResult = { status: "sent", resendAt: at(60), expiresAt: at(600) };
const EMAIL = "jane@student.ubc.ca";

let client: { sendCode: ReturnType<typeof vi.fn>; verifyCode: ReturnType<typeof vi.fn> };
let onVerified: ReturnType<typeof vi.fn<() => void>>;
let onChangeEmail: ReturnType<typeof vi.fn<() => void>>;
let onAddressChanged: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  client = { sendCode: vi.fn(), verifyCode: vi.fn() };
  onVerified = vi.fn<() => void>();
  onChangeEmail = vi.fn<() => void>();
  onAddressChanged = vi.fn<() => void>();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderStep(start: UbcCodeStart = { kind: "send", result: SENT }) {
  return render(
    <UbcCodeStep
      client={client as unknown as UbcCodeClient}
      email={EMAIL}
      start={start}
      onChangeEmail={onChangeEmail}
      onAddressChanged={onAddressChanged}
      onVerified={onVerified}
    />,
  );
}

const MESSAGE = "p:not([role=status])";
const field = () => screen.getByLabelText("Verification code") as HTMLInputElement;
const status = () => screen.getByRole("status").textContent;
const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("UbcCodeStep", () => {
  it("opens on the sent code with focus in a one-time-code field", () => {
    renderStep();
    expect(screen.getByText(EMAIL)).toBeTruthy();
    expect(screen.getByText(/Check Junk too/)).toBeTruthy();
    expect(field().getAttribute("autocomplete")).toBe("one-time-code");
    expect(field().getAttribute("inputmode")).toBe("numeric");
    expect(field().getAttribute("pattern")).toBe("[0-9]*");
    expect(document.activeElement).toBe(field());
    expect(status()).toBe("Code sent");
    expect(screen.getByText(/Can’t get the code\? Contact a UX Hub exec/)).toBeTruthy();
    expect(field().getAttribute("aria-describedby")).toBeTruthy();
  });

  it("strips pasted text to digits and submits at six", async () => {
    client.verifyCode.mockResolvedValue({ status: "verified" } satisfies UbcVerifyResult);
    renderStep();
    fireEvent.change(field(), { target: { value: "Code: 123 456" } });
    await waitFor(() => expect(client.verifyCode).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(status()).toBe("Verified");
  });

  it("keeps the field focused and selected after a wrong code, with tries left", async () => {
    client.verifyCode.mockResolvedValue({ status: "wrong", attemptsLeft: 3 });
    renderStep();
    fireEvent.change(field(), { target: { value: "111111" } });
    await screen.findByText("That code isn’t right. 3 tries left.", { selector: MESSAGE });
    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(status()).toBe("That code isn’t right. 3 tries left.");
    await waitFor(() => expect(document.activeElement).toBe(field()));
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe(6);
  });

  it("says one try, not one tries", async () => {
    client.verifyCode.mockResolvedValue({ status: "wrong", attemptsLeft: 1 });
    renderStep();
    fireEvent.change(field(), { target: { value: "111111" } });
    await screen.findByText("That code isn’t right. 1 try left.", { selector: MESSAGE });
  });

  it("asks for six digits on Verify before calling the server", async () => {
    renderStep();
    fireEvent.change(field(), { target: { value: "123" } });
    fireEvent.click(button("Verify"));
    await screen.findByText("Enter the 6-digit code from the email.", { selector: MESSAGE });
    expect(client.verifyCode).not.toHaveBeenCalled();
  });

  it("disables the field after too many tries and offers a new code", async () => {
    client.verifyCode.mockResolvedValue({ status: "locked" });
    client.sendCode.mockResolvedValue({ status: "sent", resendAt: at(70), expiresAt: at(700) });
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    renderStep();
    fireEvent.change(field(), { target: { value: "222222" } });
    await screen.findByText("Too many tries. Send a new code.", { selector: MESSAGE });
    expect(field().disabled).toBe(true);
    fireEvent.click(button("Send a new code"));
    await waitFor(() => expect(client.sendCode).toHaveBeenCalled());
    await waitFor(() => expect(field().disabled).toBe(false));
    expect(status()).toBe("Code sent");
  });

  it("turns expired when the clock passes the code's expiry", async () => {
    renderStep();
    act(() => {
      vi.advanceTimersByTime(601_000);
    });
    expect(screen.getByText("This code has expired.")).toBeTruthy();
    expect(button("Send a new code")).toBeTruthy();
    expect(field().disabled).toBe(true);
    expect(status()).toBe("Code expired");
  });

  it("shows the server's expiry too", async () => {
    client.verifyCode.mockResolvedValue({ status: "expired" });
    renderStep();
    fireEvent.change(field(), { target: { value: "333333" } });
    await screen.findByText("This code has expired.", { selector: MESSAGE });
    expect(status()).toBe("Code expired");
  });

  it("counts Resend down and announces only when it unlocks", () => {
    renderStep({ kind: "send", result: { status: "sent", resendAt: at(42), expiresAt: at(600) } });
    expect(button("Resend code in 0:42").disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(button("Resend code in 0:12")).toBeTruthy();
    expect(status()).toBe("Code sent");
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(button("Resend code").disabled).toBe(false);
    expect(status()).toBe("You can resend the code now.");
  });

  it("doesn't claim a code went to a new address during the cooldown", () => {
    renderStep({ kind: "send", result: { status: "cooldown", resendAt: at(25), expiresAt: null } });
    expect(screen.getByText(/We’ll email a 6-digit code to/)).toBeTruthy();
    expect(screen.queryByText(/We sent a 6-digit code/)).toBeNull();
    expect(screen.getByText(/You asked for a code a moment ago/)).toBeTruthy();
    expect(button("Send a new code in 0:25").disabled).toBe(true);
    expect(field().disabled).toBe(true);
  });

  it("goes back to the form when the address changed under the step", async () => {
    client.verifyCode.mockResolvedValue({ status: "address_changed" });
    renderStep();
    fireEvent.change(field(), { target: { value: "555555" } });
    await waitFor(() => expect(onAddressChanged).toHaveBeenCalled());

    onAddressChanged.mockClear();
    client.sendCode.mockResolvedValue({ status: "address_changed" });
    cleanup();
    renderStep({ kind: "send", result: { status: "send_failed" } });
    fireEvent.click(button("Send a new code"));
    await waitFor(() => expect(onAddressChanged).toHaveBeenCalled());
  });

  it("treats a cooldown with a live code as code sent", () => {
    renderStep({ kind: "send", result: { status: "cooldown", resendAt: at(20), expiresAt: at(500) } });
    expect(screen.getByText(/We sent a 6-digit code/)).toBeTruthy();
    expect(button("Resend code in 0:20")).toBeTruthy();
    expect(field().disabled).toBe(false);
  });

  it.each([
    ["daily_cap", "You’ve requested too many codes today. Try again tomorrow, or contact a UX Hub exec."],
    ["taken", "This UBC email is already verified on another UX Hub account. Contact a UX Hub exec."],
  ] as const)("stops at %s with the exec escape hatch", (result, text) => {
    renderStep({ kind: "send", result: { status: result } });
    expect(screen.getByText(text)).toBeTruthy();
    expect(field().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Verify|Resend|Send/ })).toBeNull();
    expect(button("Change email")).toBeTruthy();
  });

  it("keeps a live code usable at the daily cap, without offering Resend", () => {
    renderStep({
      kind: "pending",
      pending: { email: EMAIL, sentAt: at(-90), resendAt: at(-30), expiresAt: at(510), attemptsLeft: 5 },
    });
    expect(button("Resend code").disabled).toBe(false);
    cleanup();
    render(
      <UbcCodeStep
        client={client as unknown as UbcCodeClient}
        email={EMAIL}
        start={{ kind: "send", result: SENT }}
        initialState={{ status: "daily_cap", attemptsLeft: 5, resendAt: null, expiresAt: Date.now() + 500_000 }}
        onChangeEmail={onChangeEmail}
        onAddressChanged={onAddressChanged}
        onVerified={onVerified}
      />,
    );
    expect(field().disabled).toBe(false);
    expect(button("Verify")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Resend/ })).toBeNull();
  });

  it("lets a failed send be tried again", async () => {
    client.sendCode.mockResolvedValue(SENT);
    renderStep({ kind: "send", result: { status: "send_failed" } });
    expect(screen.getByText("We couldn’t send the code. Try again.")).toBeTruthy();
    fireEvent.click(button("Send a new code"));
    await waitFor(() => expect(client.sendCode).toHaveBeenCalled());
    await waitFor(() => expect(field().disabled).toBe(false));
  });

  it("reopens on a pending code with the tries it has left", () => {
    renderStep({
      kind: "pending",
      pending: { email: EMAIL, sentAt: at(-30), resendAt: at(30), expiresAt: at(570), attemptsLeft: 2 },
    });
    expect(field().disabled).toBe(false);
    expect(button("Resend code in 0:30")).toBeTruthy();
    // Reopening announces nothing new.
    expect(status()).toBe("");
  });

  it("returns to the form on Change email", () => {
    renderStep();
    fireEvent.click(button("Change email"));
    expect(onChangeEmail).toHaveBeenCalled();
  });

  it("clears the field when a newer code superseded this one", async () => {
    client.verifyCode.mockResolvedValue({ status: "stale" });
    renderStep();
    fireEvent.change(field(), { target: { value: "444444" } });
    await screen.findByText("We sent a newer code. Enter the code from the latest email.", { selector: MESSAGE });
    expect(field().value).toBe("");
  });
});

describe("stateAfterSend", () => {
  it("keeps a locked code locked through a cooldown", () => {
    const locked = { status: "locked" as const, attemptsLeft: 0, resendAt: null, expiresAt: Date.now() + 1000 };
    expect(stateAfterSend({ status: "cooldown", resendAt: at(10), expiresAt: at(100) }, locked).status).toBe("locked");
  });

  it("resets the tries on a fresh send", () => {
    expect(stateAfterSend(SENT, null)).toMatchObject({ status: "code_sent", attemptsLeft: 5 });
  });
});

describe("formatCountdown", () => {
  it("reads as minutes and seconds", () => {
    expect(formatCountdown(42)).toBe("0:42");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(5)).toBe("0:05");
  });
});
