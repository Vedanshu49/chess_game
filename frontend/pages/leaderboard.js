import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState('all_time');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchLeaderboard();
    }
  }, [user, authLoading, router, timeFrame]);

  async function fetchLeaderboard() {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        time_frame: timeFrame
      });
      if (error) throw error;
      setLeaderboardData(data);
    } catch (error) {
      toast.error('Failed to fetch leaderboard: ' + error.message);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  const TimeFrameButton = ({ frame, label }) => (
    <button
      onClick={() => setTimeFrame(frame)}
      className={`btn ${timeFrame === frame ? 'bg-accent' : 'bg-muted'}`}
    >
      {label}
    </button>
  );

  if (authLoading || leaderboardLoading) {
    return (
      <PageWithHeader user={user} title="Leaderboard">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Leaderboard">
      <div className="flex justify-end gap-2 mb-4">
        <TimeFrameButton frame="all_time" label="All Time" />
        <TimeFrameButton frame="weekly" label="Weekly" />
        <TimeFrameButton frame="monthly" label="Monthly" />
      </div>
      <div className="bg-panel rounded-lg shadow-lg text-text">
        <table className="w-full text-left">
          <thead className="bg-[#222222]">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4">{timeFrame === 'all_time' ? 'Rating' : 'Wins'}</th>
              {timeFrame !== 'all_time' && <th className="p-4">Rating</th>}
            </tr>
          </thead>
          <tbody>
            {leaderboardData.map((player, index) => (
              <tr key={player.username} className="border-b border-muted">
                <td className="p-4">{index + 1}</td>
                <td className="p-4">{player.username}</td>
                <td className="p-4">{timeFrame === 'all_time' ? player.rating : player.wins}</td>
                {timeFrame !== 'all_time' && <td className="p-4">{player.rating}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboardData.length === 0 && (
          <p className="p-4 text-center">No data available for this time frame.</p>
        )}
      </div>
    </PageWithHeader>
  );
}
