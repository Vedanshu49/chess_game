"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabasejs"

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserAndProfile() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          setUser(session.user); // Still set auth user even if profile fetch fails
        } else {
          setUser({ ...session.user, profile }); // Combine auth user and profile
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }

    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile on auth state change:", error);
          setUser(session.user);
        } else {
          setUser({ ...session.user, profile });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
