import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthProvider' // Import useAuth

export default function HistoryPage() {
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
    if (!user) return
    setGamesLoading(true)

    const { data, error } = await supabase
      .from('games')
      .select(`
        id,
        created_at,
        result,
        opponentProfile:opponent ( username ),
        creatorProfile:creator ( username )
      `)
      .or(`creator.eq.${user.id},opponent.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching games:', error)
    } else {
      setGames(data)
    }

    setGamesLoading(false)
  }

  if (loading || gamesLoading) { // Display loading from AuthProvider or games fetching
    return <div>Loading...</div>
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Game History</h1>
        <div className="bg-[#1c2836] rounded-lg shadow-lg">
          <ul className="divide-y divide-[#233041]">
            {games.map(game => (
              <li key={game.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    {game.creatorProfile.username} vs {game.opponentProfile.username}
                  </p>
                  <p className="text-sm text-gray-400">
                    {new Date(game.created_at).toLocaleDateString()} - {game.result}
                  </p>
                </div>
                <button 
                  onClick={() => router.push(`/game/${game.id}?analysis=true`)}
                  className="btn bg-blue-600 hover:bg-blue-700"
                >
                  Replay
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
