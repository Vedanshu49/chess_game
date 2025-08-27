import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'

export default function SpectatePage() {
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
    setLoading(true)
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
    setLoading(false)
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Spectate Games</h1>
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
        )}
      </div>
    </>
  )
}
