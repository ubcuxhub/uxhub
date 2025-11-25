"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@/lib/types/membershipTypes";

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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authUser = session?.user;
    if (!authUser) {
      // async defer to avoid hook mismatch
      setTimeout(() => setUser(null), 0);
      setLoading(false);
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
      } else {
        setUser(member);
      }
      setLoading(false);
    }, 0);
  };

  useEffect(() => {
    // Defer initial load to avoid synchronous setState warnings
    setTimeout(() => loadUser(), 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setTimeout(() => {
          setUser(null);
        }, 0);
        return;
      }

      setTimeout(() => loadUser(), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: loadUser }}>
      {children}
    </UserContext.Provider>
  );
}
