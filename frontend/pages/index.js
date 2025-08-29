import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text px-6">
      <div className="bg-panel shadow-2xl rounded-2xl p-10 max-w-md w-full">
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-bold">Chess App</h1>
          <div className="text-xs text-muted mt-1" style={{ whiteSpace: 'pre' }}>    A project by Vedanshu</div>
        </div>
        <h2 className="text-xl font-bold text-center mb-6">Welcome Back</h2>
        <p className="text-muted text-center mb-8">
          Login to continue to your dashboard
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#222222] border border-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#222222] border border-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn w-full"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="flex justify-between mt-6 text-sm text-muted">
          <a href="/signup" className="hover:text-text">
            New here? Create an account
          </a>
          <a href="/forgot-password" className="hover:text-text">
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  );
}
