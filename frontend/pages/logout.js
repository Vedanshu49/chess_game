import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    // Remove Supabase session
    supabase.auth.signOut();
    // Remove all local/session storage data
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      // Remove all cookies
      document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
      });
    }
    // Redirect to login page
    router.replace("/login");
  }, [router]);

  return null;
}
