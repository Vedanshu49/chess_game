import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthProvider' // Import useAuth

export default function SpectatePage() {
  const { user, loading } = useAuth(); // Use the useAuth hook
  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true) // Renamed to avoid conflict with auth loading
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchGames();
    }
  }, [user, loading, router]);

  async function fetchGames() {
    setGamesLoading(true)
    const { data, error } = await supabase
      .from('games')
      .select(`
        id,
        creatorProfile:creator ( username ),
        opponentProfile:opponent ( username )
      `)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching games:', error)
    } else {
      setGames(data)
    }
    setGamesLoading(false)
  }

  if (loading || gamesLoading) { // Display loading from AuthProvider or games fetching
    return <p>Loading...</p>
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Spectate Games</h1>
        <div className="bg-[#1c2836] rounded-lg shadow-lg">
          <ul className="divide-y divide-[#233041]">
            {games.map(game => (
              <li key={game.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    {game.creatorProfile.username} vs {game.opponentProfile.username}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/game/${game.id}?spectate=true`)}
                  className="btn bg-blue-600 hover:bg-blue-700"
                >
                  Watch
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
