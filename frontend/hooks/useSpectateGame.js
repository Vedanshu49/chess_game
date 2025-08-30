import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import toast from 'react-hot-toast';

export const useSpectateGame = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchGames = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          creatorProfile:creator ( username ),
          opponentProfile:opponent ( username ),
          status,
          created_at
        `)
        .filter('status', 'in', '("in_progress","paused")')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching games:', error);
        toast.error('Error fetching games: ' + error.message);
        if (mounted) setGames([]);
      } else {
        if (mounted) setGames(data || []);
      }
      if (mounted) setLoading(false);
    };

    fetchGames();
    return () => { mounted = false; };
  }, []);

  return { games, loading };
};
