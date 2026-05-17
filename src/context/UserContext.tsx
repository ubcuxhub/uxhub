"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/features/auth";

const supabase = createClient();

interface UserContextType {
  user: User | null;
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
  initialUser?: User | null;
}

export function UserProvider({
  children,
  initialUser = null,
}: UserProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const hasUser = useRef(Boolean(initialUser));

  const loadUser = async (silent = false) => {
    // Only set loading if this is not a silent refresh and we don't have a user yet
    if (!silent && !hasUser.current) {
      setLoading(true);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authUser = session?.user;
    if (!authUser) {
      // async defer to avoid hook mismatch
      setTimeout(() => {
        setUser(null);
        hasUser.current = false;
        setLoading(false);
      }, 0);
      return;
    }

    const { data: member, error } = await supabase
      .from("user_info")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .single();

    setTimeout(() => {
      if (error) {
        setUser(null);
        hasUser.current = false;
      } else {
        setUser(member);
        hasUser.current = true;
      }
      setLoading(false);
    }, 0);
  };

  useEffect(() => {
    // Defer initial load to avoid synchronous setState warnings
    setTimeout(() => loadUser(false), 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore TOKEN_REFRESHED events - they don't require a full reload
      // and are common when tab regains focus
      if (event === "TOKEN_REFRESHED" && hasUser.current) {
        return;
      }

      if (!session?.user) {
        setTimeout(() => {
          setUser(null);
          hasUser.current = false;
          setLoading(false);
        }, 0);
        return;
      }

      // Use silent refresh if we already have a user (prevents loading flicker)
      const shouldBeSilent = hasUser.current && event === "TOKEN_REFRESHED";
      setTimeout(() => loadUser(shouldBeSilent), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, loading, refreshUser: () => loadUser(false) }}
    >
      {children}
    </UserContext.Provider>
  );
}
