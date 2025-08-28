import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchGames();
    }
  }, [user, authLoading, router]);

  async function fetchGames() {
    if (!user) return;
    setGamesLoading(true);
    try {
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
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGames(data);
    } catch (error) {
      toast.error('Failed to fetch game history: ' + error.message);
    } finally {
      setGamesLoading(false);
    }
  }

  if (authLoading || gamesLoading) {
    return (
      <PageWithHeader user={user} title="Game History">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Game History">
      <div className="bg-[#1c2836] rounded-lg shadow-lg">
        <ul className="divide-y divide-[#233041]">
          {games.map(game => (
            <li key={game.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {game.creatorProfile?.username || 'Unknown'} vs {game.opponentProfile?.username || 'Unknown'}
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
        {games.length === 0 && (
          <p className="p-4 text-center">No games found.</p>
        )}
      </div>
    </PageWithHeader>
  );
}
