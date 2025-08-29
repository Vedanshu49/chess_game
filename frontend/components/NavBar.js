import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import { useTheme } from "@/lib/ThemeContext";

export default function Navbar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error('Logout failed: ' + error.message);
        console.error('Logout error:', error);
      } else {
        router.replace("/login");
      }
    } catch (error) {
      toast.error('An unexpected error occurred during logout.');
      console.error('Unexpected logout error:', error);
    }
  };

  return (
    <nav className="bg-panel px-6 py-4 flex justify-between items-center shadow-md">
      <div className="flex flex-col cursor-pointer" onClick={() => router.push("/dashboard") }>
        <span className="text-2xl font-bold text-text">♟ Chess App</span>
        <span className="text-xs text-muted ml-6" style={{lineHeight:'1.1'}}>A project by Vedanshu</span>
      </div>
      <div class="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="text-text hover:text-text transition"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          onClick={() => router.push("/profile")}
          className="text-text hover:text-text transition"
        >
          Profile
        </button>
        <button
          onClick={() => router.push("/friends")}
          className="text-text hover:text-text transition"
        >
          Friends
        </button>
        <button
          onClick={() => router.push("/search")}
          className="text-text hover:text-text transition"
        >
          Search
        </button>
        <button
          onClick={() => router.push("/history")}
          className="text-text hover:text-text transition"
        >
          History
        </button>
        <button
          onClick={() => router.push("/saved-positions")}
          className="text-text hover:text-text transition"
        >
          Saved Positions
        </button>
        <button
          onClick={() => router.push("/leaderboard")}
          className="text-text hover:text-text transition"
        >
          Leaderboard
        </button>
        <button
          onClick={() => router.push("/spectate")}
          className="text-text hover:text-text transition"
        >
          Spectate
        </button>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
