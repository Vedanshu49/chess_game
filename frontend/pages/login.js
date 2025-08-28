import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // New loading state

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // Set loading to true

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error("Supabase login error:", authError);
        setError(authError.message);
      } else if (data && data.user) {
        console.log("Login successful, user:", data.user);
        router.replace("/dashboard");
      } else {
        // This case should ideally not be reached if Supabase client works as expected
        console.warn("Login did not return user data or explicit error.");
        setError("Login failed. Please check your credentials.");
      }
    } catch (err) {
      console.error("Unexpected login error (caught by outer try-catch):", err);
      setError(err.message || "An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      <div className="bg-gray-950 p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6">Welcome Back</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            name="email"
            autocomplete="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
            disabled={loading} // Disable button while loading
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center text-gray-400 text-sm">
          New here?{" "}
          <a href="/signup" className="text-blue-500 hover:underline">
            Create an account
          </a>
        </div>
        <div className="mt-2 text-center text-gray-400 text-sm">
          Forgot your password?{" "}
          <a href="/forgot-password" className="text-blue-500 hover:underline">
            Reset it here
          </a>
        </div>
      </div>
    </div>
  );
}
