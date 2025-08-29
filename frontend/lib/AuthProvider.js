"use client"
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabasejs";
import LoadingSpinner from "@/components/LoadingSpinner"; // Make sure the path is correct

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId;
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
          // No valid session: clear all browser storage and cookies, redirect to login
          setUser(null);
          if (typeof window !== "undefined") {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(';').forEach((c) => {
              document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
            });
            window.location.replace("/login");
          }
        }
      } catch (e) {
        console.error("Error in getSession:", e);
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(';').forEach((c) => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
          });
          window.location.replace("/login");
        }
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    // Timeout: if loading takes >10s, clear storage/cookies and redirect to login
    timeoutId = setTimeout(() => {
      if (loading) {
        setUser(null);
        setLoading(false);
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(';').forEach((c) => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
          });
          window.location.replace("/login");
        }
      }
    }, 10000);

    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (error) {
          console.error("Error fetching profile on auth change:", error);
          setUser(null);
        } else {
          setUser(profile ? { ...session.user, profile } : session.user);
        }
      } else {
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(';').forEach((c) => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
          });
          window.location.replace("/login");
        }
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
      clearTimeout(timeoutId);
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
