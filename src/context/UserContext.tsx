"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import type { UserInfoRow } from "@/types/models";

const supabase = createClient();

interface UserContextType {
  user: UserInfoRow | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: React.ReactNode;
  initialUser?: UserInfoRow | null;
}

export function UserProvider({
  children,
  initialUser = null,
}: UserProviderProps) {
  const [user, setUser] = useState<UserInfoRow | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const loadUser = useCallback(async (authUserId?: string) => {
    setLoading(true);
    let userId = authUserId;

    if (!userId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      userId = session?.user.id;
    }

    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setUser(await fetchUserInfoByAuthId(supabase, userId));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) {
      void loadUser();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      void loadUser(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [initialUser, loadUser]);

  return (
    <UserContext.Provider
      value={{ user, loading, refreshUser: () => loadUser() }}
    >
      {children}
    </UserContext.Provider>
  );
}
