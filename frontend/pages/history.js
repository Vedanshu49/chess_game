import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'

export default function HistoryPage() {
  const [user, setUser] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        setUser(auth.user)
      } else {
        router.replace('/login')
      }
    })()
  }, [])

  useEffect(() => {
    if (user) {
      fetchGames()
    }
  }, [user])

  async function fetchGames() {
    if (!user) return
    setLoading(true)

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

    setLoading(false)
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Game History</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
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
        )}
      </div>
    </>
  )
}
