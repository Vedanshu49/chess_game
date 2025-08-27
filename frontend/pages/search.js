import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'

export default function SearchPage() {
  const [user, setUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [challengeModal, setChallengeModal] = useState({ isOpen: false, friendId: null, friendUsername: null })
  const [timeControl, setTimeControl] = useState({ time: 5, increment: 0 })
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
    const debounce = setTimeout(() => {
      if (searchTerm.trim().length > 1) {
        performSearch()
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(debounce)
  }, [searchTerm])

  async function performSearch() {
    setLoading(true)
    const { data, error } = await supabase.rpc('search_players', { 
      search_term: searchTerm 
    })

    if (error) {
      console.error('Error searching players:', error)
      alert(error.message)
    } else {
      setResults(data)
    }
    setLoading(false)
  }

  async function handleSendRequest(friendId) {
    if (!user) return;

    const { error } = await supabase.from('friends').insert({
      user_id: user.id,
      friend_id: friendId,
      status: 'pending'
    });

    if (error) {
      alert(error.message);
    } else {
      alert('Friend request sent!');
    }
  }

  async function handleChallenge() {
    if (!user || !challengeModal.friendId) return

    const { data, error } = await supabase
      .from('games')
      .insert({
        creator: user.id,
        opponent: challengeModal.friendId,
        status: 'waiting',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'white',
        initial_time_seconds: timeControl.time * 60,
        increment_seconds: timeControl.increment,
      })
      .select()

    if (error) {
      alert('Error creating game: ' + error.message)
    } else {
      setChallengeModal({ isOpen: false, friendId: null, friendUsername: null });
      router.push(`/game/${data[0].id}`)
    }
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Search Players</h1>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Enter username..."
          className="w-full bg-[#0e141b] rounded-lg px-4 py-2 mb-4"
        />

        {challengeModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-[#1c2836] p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Challenge {challengeModal.friendUsername}</h2>
              <div className="space-y-4">
                <p>Select Time Control:</p>
                <div className="flex flex-wrap gap-2">
                  {[ {t:1,i:0}, {t:3,i:2}, {t:5,i:0}, {t:10,i:5} ].map(tc => (
                    <button key={`${tc.t}-${tc.i}`} onClick={() => setTimeControl({ time: tc.t, increment: tc.i })} className={`btn ${timeControl.time === tc.t && timeControl.increment === tc.i ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {tc.t}+{tc.i}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setChallengeModal({ isOpen: false, friendId: null, friendUsername: null })} className="btn bg-gray-700">Cancel</button>
                <button onClick={handleChallenge} className="btn bg-blue-600">Send Challenge</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="space-y-2">
            {results.map(player => (
              <li key={player.id} className="bg-[#1c2836] p-3 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-bold">{player.username}</span>
                  <span className="text-muted ml-2">({player.rating})</span>
                </div>
                <div className="flex gap-2">
                  {user?.id !== player.id && (
                    <>
                      <button onClick={() => handleSendRequest(player.id)} className="btn bg-green-600 hover:bg-green-700">Add Friend</button>
                      <button onClick={() => setChallengeModal({ isOpen: true, friendId: player.id, friendUsername: player.username })} className="btn bg-blue-600 hover:bg-blue-700">Challenge</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
