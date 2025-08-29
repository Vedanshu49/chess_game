import { useState } from "react";
import { supabase } from "@/lib/supabasejs";
import { useRouter } from "next/router";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Signup function
  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (error) setError(error.message);
    else alert("Signup successful! Check your email for confirmation.");
  };

  // Login function
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) setError(error.message);
    else router.push("/dashboard"); // redirect after login
  };

  return (
    <div className="bg-bg text-text min-h-screen flex flex-col items-center justify-center">
      <div className="p-8 rounded-lg shadow-lg w-full max-w-md bg-panel">
        <h1 className="text-2xl font-bold mb-6 text-center">Login / Signup</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-4"
        />
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <button onClick={handleLogin} disabled={loading} className="btn w-full mb-2">
          {loading ? "Logging in..." : "Login"}
        </button>
        <button onClick={handleSignup} disabled={loading} className="btn w-full">
          {loading ? "Signing up..." : "Signup"}
        </button>
      </div>
    </div>
  );
}
