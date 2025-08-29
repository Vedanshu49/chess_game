import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthProvider' // Import useAuth

export default function SpectatePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading } = useAuth(); // Use the useAuth hook
  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true) // Renamed to avoid conflict with auth loading
  const router = useRouter()

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    async function fetchGames() {
      setGamesLoading(true);
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          creatorProfile:creator ( username ),
          opponentProfile:opponent ( username )
        `)
        .filter('status', 'in', '("in_progress","paused")')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching games:', error);
        toast.error('Error fetching games: ' + error.message);
        setGames([]);
      } else {
        setGames(data);
      }
      setGamesLoading(false);
    }

    fetchGames();
  }, [user, loading, router]);

  if (loading || gamesLoading) {
    return (
      <>
        <NavBar user={user} />
        <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center">
          <p>Loading games...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar user={user} />
      <div className="min-h-screen bg-bg text-text p-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="btn mb-4"
        >
          &larr; Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold mb-4">Spectate Games</h1>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by username..."
          className="input mb-4"
        />
        <div className="bg-panel rounded-lg shadow-lg">
          {games.length > 0 ? (
            <ul className="divide-y divide-muted">
              {games.filter(game =>
                (game.creatorProfile?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 game.opponentProfile?.username?.toLowerCase().includes(searchTerm.toLowerCase()))
              ).map(game => (
                <li key={game.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {game.creatorProfile?.username || 'Player 1'} vs {game.opponentProfile?.username || 'Player 2'}
                    </p>
                    <p className="text-muted text-sm">Status: {game.status?.replace('_', ' ') || 'Unknown'}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/game/${game.id}?spectate=true`)}
                    className="btn bg-accent"
                  >
                    Watch
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center">No active games to spectate.</p>
          )}
        </div>
      </div>
    </>
  )
}
