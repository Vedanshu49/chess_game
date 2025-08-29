"use client"
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabasejs";
import LoadingSpinner from "@/components/LoadingSpinner"; // Make sure the path is correct

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(profile ? { ...session.user, profile } : session.user);
          if (error) console.error("Error fetching profile:", error);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error("Error in getSession:", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      if (session) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUser(profile ? { ...session.user, profile } : session.user);
        if (error) console.error("Error fetching profile on auth change:", error);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-bg">
          <LoadingSpinner />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
