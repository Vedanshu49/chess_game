import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function LeaderboardPage() {
  const [user, setUser] = useState(null)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState('all_time') // 'all_time', 'weekly', 'monthly'
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
      fetchLeaderboard()
    }
  }, [user, timeFrame])

  async function fetchLeaderboard() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_leaderboard', {
      time_frame: timeFrame
    })

    if (error) {
      console.error('Error fetching leaderboard:', error)
      alert(error.message)
    } else {
      setLeaderboardData(data)
    }
    setLoading(false)
  }

  const TimeFrameButton = ({ frame, label }) => (
    <button
      onClick={() => setTimeFrame(frame)}
      className={`btn ${timeFrame === frame ? 'bg-blue-600' : 'bg-gray-700'}`}>
      {label}
    </button>
  )

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <div className="flex gap-2">
            <TimeFrameButton frame="all_time" label="All Time" />
            <TimeFrameButton frame="weekly" label="Weekly" />
            <TimeFrameButton frame="monthly" label="Monthly" />
          </div>
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-[#1c2836] rounded-lg shadow-lg">
            <table className="w-full text-left">
              <thead className="bg-[#233041]">
                <tr>
                  <th className="p-4">Rank</th>
                  <th className="p-4">Player</th>
                  <th className="p-4">{timeFrame === 'all_time' ? 'Rating' : 'Wins'}</th>
                  {timeFrame !== 'all_time' && <th className="p-4">Rating</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((player, index) => (
                  <tr key={player.username} className="border-b border-[#233041]">
                    <td className="p-4">{index + 1}</td>
                    <td className="p-4">{player.username}</td>
                    <td className="p-4">{timeFrame === 'all_time' ? player.rating : player.wins}</td>
                    {timeFrame !== 'all_time' && <td className="p-4">{player.rating}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
