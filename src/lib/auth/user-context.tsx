"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import type { UserInfoRow } from "@/lib/supabase/models";

const supabase = createClient();

/** The signed-in user's row, or null when signed out or unreadable. */
async function fetchCurrentUser(authUserId?: string) {
  let userId = authUserId;

  if (!userId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    userId = session?.user.id;
  }

  if (!userId) return null;

  try {
    return await fetchUserInfoByAuthId(supabase, userId);
  } catch {
    return null;
  }
}

interface UserContextType {
  user: UserInfoRow | null;
  /**
   * Club-wide membership ceiling, or null when none is set. Every client-side
   * `hasActiveMembership` call needs it, so it rides along with the user rather
   * than being fetched per component.
   */
  membershipTermEndsAt: string | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  membershipTermEndsAt: null,
  loading: true,
  refreshUser: async () => {},
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: React.ReactNode;
  initialUser?: UserInfoRow | null;
  initialTermEndsAt?: string | null;
}

export function UserProvider({
  children,
  initialUser = null,
  initialTermEndsAt,
}: UserProviderProps) {
  const [user, setUser] = useState<UserInfoRow | null>(initialUser);
  const [membershipTermEndsAt, setMembershipTermEndsAt] = useState<
    string | null
  >(initialTermEndsAt ?? null);
  const [loading, setLoading] = useState(!initialUser);

  const loadUser = useCallback(async (authUserId?: string) => {
    setLoading(true);
    const nextUser = await fetchCurrentUser(authUserId);
    setUser(nextUser);
    setLoading(false);
  }, []);

  // The term end gates signed-out copy too — the marketing calls to action hide
  // themselves once memberships close — so it loads regardless of auth state,
  // separately from the user. It is readable with the anon key.
  useEffect(() => {
    if (initialTermEndsAt !== undefined) return;

    let active = true;
    void fetchMembershipTermEndsAt(supabase)
      .then((value) => {
        if (active) setMembershipTermEndsAt(value);
      })
      .catch(() => {
        // Leave the ceiling unset; members keep their own expiry dates.
      });

    return () => {
      active = false;
    };
  }, [initialTermEndsAt]);

  useEffect(() => {
    // Subscribing emits INITIAL_SESSION with the current session (or none),
    // which is the provider's first load: a separate fetch on mount would read
    // the row twice. When the server already supplied this session's row, the
    // first event has nothing to add, so it reads nothing.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (
        event === "INITIAL_SESSION" &&
        initialUser?.auth_user_id === session.user.id
      ) {
        return;
      }

      void loadUser(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [initialUser, loadUser]);

  return (
    <UserContext.Provider
      value={{
        user,
        membershipTermEndsAt,
        loading,
        refreshUser: () => loadUser(),
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
