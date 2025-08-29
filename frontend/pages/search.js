import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function SearchPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [challengeModal, setChallengeModal] = useState({ isOpen: false, friendId: null, friendUsername: null });
  const [timeControl, setTimeControl] = useState({ time: 5, increment: 0 });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim().length > 1 && user) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm, user]);

  async function performSearch() {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_players', {
        search_term: searchTerm
      });
      if (error) throw error;
      setResults(data);
    } catch (error) {
      toast.error('Error searching players: ' + error.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSendRequest(friendId) {
    if (!user) return;
    try {
      const { error } = await supabase.from('friends').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
      });
      if (error) throw error;
      toast.success('Friend request sent!');
    } catch (error) {
      toast.error('Error sending friend request: ' + error.message);
    }
  }

  async function handleChallenge() {
    if (!user || !challengeModal.friendId) return;
    try {
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
        .select();
      if (error) throw error;
      setChallengeModal({ isOpen: false, friendId: null, friendUsername: null });
      router.push(`/game/${data[0].id}`);
    } catch (error) {
      toast.error('Error creating challenge: ' + error.message);
    }
  }

  if (authLoading) {
    return (
      <PageWithHeader user={user} title="Search Players">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Search Players">
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Enter username..."
        className="input mb-4"
      />

      {challengeModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-panel p-6 rounded-lg w-full max-w-md text-text">
            <h2 className="text-xl font-bold mb-4">Challenge {challengeModal.friendUsername}</h2>
            <div className="space-y-4">
              <p>Select Time Control:</p>
              <div className="flex flex-wrap gap-2">
                {[ {t:1,i:0}, {t:3,i:2}, {t:5,i:0}, {t:10,i:5} ].map(tc => (
                  <button key={`${tc.t}-${tc.i}`} onClick={() => setTimeControl({ time: tc.t, increment: tc.i })} className={`btn ${timeControl.time === tc.t && timeControl.increment === tc.i ? 'bg-green-600' : 'bg-muted'}`}>
                    {tc.t}+{tc.i}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => setChallengeModal({ isOpen: false, friendId: null, friendUsername: null })} className="btn bg-[#222222]">Cancel</button>
              <button onClick={handleChallenge} className="btn bg-accent">Send Challenge</button>
            </div>
          </div>
        </div>
      )}

      {searchLoading ? (
        <LoadingSpinner />
      ) : (
        <ul className="space-y-2">
          {results.map(player => (
            <li key={player.id} className="bg-panel p-3 rounded-lg flex justify-between items-center text-text">
              <div>
                <span className="font-bold">{player.username}</span>
                <span className="text-muted ml-2">({player.rating})</span>
              </div>
              <div className="flex gap-2">
                {user?.id !== player.id && (
                  <>
                    <button onClick={() => handleSendRequest(player.id)} className="btn bg-green-600 hover:bg-green-700">Add Friend</button>
                    <button onClick={() => setChallengeModal({ isOpen: true, friendId: player.id, friendUsername: player.username })} className="btn bg-accent">Challenge</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageWithHeader>
  );
}
