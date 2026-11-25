// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";

type AuthListener = (event: string, session: { user: { id: string } } | null) => void;

const auth = vi.hoisted(() => ({
  listeners: [] as AuthListener[],
  getSession: vi.fn(),
}));
const fetchUserInfoByAuthId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: auth.getSession,
      onAuthStateChange: (listener: AuthListener) => {
        auth.listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));
vi.mock("@/lib/supabase-helpers/users", () => ({ fetchUserInfoByAuthId }));
vi.mock("@/lib/supabase-helpers/app-settings", () => ({
  fetchMembershipTermEndsAt: vi.fn(async () => null),
}));

import { UserProvider, useUser } from "./user-context";

const row = { id: "user-1", auth_user_id: "auth-1", first_name: "Server" } as UserInfoRow;

function Probe() {
  const { user, loading } = useUser();
  return <p>{loading ? "loading" : (user?.first_name ?? "signed out")}</p>;
}

function emit(event: string, session: { user: { id: string } } | null) {
  act(() => auth.listeners.forEach((listener) => listener(event, session)));
}

describe("UserProvider", () => {
  afterEach(cleanup);
  beforeEach(() => {
    auth.listeners = [];
    fetchUserInfoByAuthId.mockReset().mockResolvedValue({ ...row, first_name: "Fetched" });
  });

  it("doesn't re-read the row the server already supplied", () => {
    render(
      <UserProvider initialUser={row} initialTermEndsAt={null}>
        <Probe />
      </UserProvider>,
    );
    emit("INITIAL_SESSION", { user: { id: "auth-1" } });

    expect(screen.getByText("Server")).toBeTruthy();
    expect(fetchUserInfoByAuthId).not.toHaveBeenCalled();
  });

  it("reads the row once, from the initial session, when the server didn't", async () => {
    render(
      <UserProvider initialTermEndsAt={null}>
        <Probe />
      </UserProvider>,
    );
    expect(screen.getByText("loading")).toBeTruthy();
    emit("INITIAL_SESSION", { user: { id: "auth-1" } });

    await waitFor(() => expect(screen.getByText("Fetched")).toBeTruthy());
    expect(fetchUserInfoByAuthId).toHaveBeenCalledOnce();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("settles as signed out when there is no session", () => {
    render(
      <UserProvider initialTermEndsAt={null}>
        <Probe />
      </UserProvider>,
    );
    emit("INITIAL_SESSION", null);

    expect(screen.getByText("signed out")).toBeTruthy();
    expect(fetchUserInfoByAuthId).not.toHaveBeenCalled();
  });

  it("still reloads when the session changes to someone else", async () => {
    render(
      <UserProvider initialUser={row} initialTermEndsAt={null}>
        <Probe />
      </UserProvider>,
    );
    emit("SIGNED_IN", { user: { id: "auth-2" } });

    await waitFor(() => expect(screen.getByText("Fetched")).toBeTruthy());
    expect(fetchUserInfoByAuthId).toHaveBeenCalledWith(expect.anything(), "auth-2");
  });
});
