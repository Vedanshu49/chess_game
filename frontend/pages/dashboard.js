import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import Navbar from "../components/NavBar";
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthProvider';

function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [showStartModal, setShowStartModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchingGameId, setSearchingGameId] = useState(null);

  // Real-time listener for game status updates
  useEffect(() => {
    let gameChannel = null;

    if (searchingGameId) {
      gameChannel = supabase
        .channel(`game_lobby:${searchingGameId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${searchingGameId}` }, (payload) => {
          const updatedGame = payload.new;
          if (updatedGame.status === 'in_progress' && updatedGame.players_joined === 2) {
            toast.success('Opponent found! Joining game...');
            router.push(`/game/${updatedGame.id}`);
          }
        })
        .subscribe();
    }

    return () => {
      if (gameChannel) {
        supabase.removeChannel(gameChannel);
      }
    };
  }, [searchingGameId, router]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  async function handleCreateLocalGame() {
    try {
      router.push('/local-game');
    } catch (error) {
      console.error("Error navigating to local game:", error);
      toast.error("Failed to start local game.");
    }
  }

  async function handleCreateCodeGame() {
    if (!user || !user.id) { toast.error("You must be logged in to create a game."); return; }
    setSearching(true);
    const inviteCode = generateInviteCode();
    try {
      const { data, error } = await supabase
        .from('games')
        .insert({
          status: 'waiting',
          invite_code: inviteCode,
          creator: user.id,
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          initial_time_seconds: 600,
          white_time_left: 600,
          black_time_left: 600,
          players_joined: 1, // New field
        })
        .select()
        .single();
      if (error) {
        toast.error('Error creating game: ' + error.message);
        return;
      }
      if (data) {
        setSearchingGameId(data.id); // Set game ID, let useEffect handle redirect
        toast.success(`Private game created! Share code: ${data.invite_code}`); // Show code here
      }
    } catch (error) {
      console.error("Error in handleCreateCodeGame:", error);
      toast.error("An unexpected error occurred while creating private game.");
    } finally {
      setSearching(false);
    }
  }

  async function handlePlayOnline() {
    if (!user || !user.id) { toast.error("You must be logged in to play online."); return; }
    setSearching(true);

    try {
      const { data: waitingGame, error: findError } = await supabase
        .from('games')
        .select('id, status, players_joined') // Select only necessary fields
        .eq('status', 'waiting')
        .is('opponent', null)
        .is('invite_code', null)
        .neq('creator', user.id)
        .limit(1)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 means no rows found
        setSearching(false);
        toast.error('Error finding game: ' + findError.message);
        return;
      }

      if (waitingGame) {
        // Found a game, try to join it
        const { error: updateError } = await supabase
          .from('games')
          .update({ opponent: user.id, status: 'in_progress', players_joined: 2 }) // Update players_joined
          .eq('id', waitingGame.id);
        
        if (updateError) {
          toast.error('Error joining game: ' + updateError.message);
          setSearching(false);
          return;
        }
        setSearchingGameId(waitingGame.id); // Set game ID, let useEffect handle redirect
        toast.success('Joined a game! Waiting for it to start...');
      } else {
        // No game found, create a new one
        const { data: newGame, error: createError } = await supabase
          .from('games')
          .insert({
            status: 'waiting',
            creator: user.id,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            initial_time_seconds: 600,
            white_time_left: 600,
            black_time_left: 600,
            players_joined: 1,
          })
          .select('id') // Select only ID
          .single();

        if (createError) {
          toast.error('Error creating game: ' + createError.message);
          setSearching(false);
          return;
        }

        if (newGame) {
          setSearchingGameId(newGame.id);
          toast('Searching for an opponent...');
        }
      }
    } catch (error) {
      console.error("Error in handlePlayOnline:", error);
      toast.error("An unexpected error occurred while playing online.");
    } finally {
      setSearching(false); // Ensure searching state is cleared
    }
  }

  async function handleCancelSearch() {
    if (!searchingGameId) return;
    setSearching(false);
    // Unsubscribe from the channel before deleting the game
    supabase.removeChannel(`game_lobby:${searchingGameId}`);
    setSearchingGameId(null);
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', searchingGameId);
      if (error) {
        toast.error('Error cancelling search: ' + error.message);
      } else {
        toast.success('Search cancelled.');
      }
    } catch (error) {
      console.error("Error in handleCancelSearch:", error);
      toast.error("An unexpected error occurred while cancelling search.");
    }
  }

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold">Chess App</h1>
            <div className="text-xs text-gray-400 mt-1" style={{ whiteSpace: 'pre' }}>    A project by Vedanshu</div>
          </div>
          <div className="text-lg">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-start">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Chess App</h1>
          <div className="text-xs text-gray-400 mt-1" style={{ whiteSpace: 'pre' }}>    A project by Vedanshu</div>
          </div>
        <h2 className="text-2xl font-bold mb-6">Welcome, {(user.profile && user.profile.username) ? user.profile.username : user.email}</h2>
        <button className="btn mb-8" onClick={() => setShowStartModal(true)}>Start Game</button>
        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-[#1a2233] p-8 rounded-lg shadow-lg w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-white" onClick={() => setShowStartModal(false)}>✕</button>
              <h2 className="text-2xl font-bold mb-6 text-center">Start Game</h2>
              <button className="btn w-full mb-4" onClick={handleCreateLocalGame} disabled={searching}>
                {searching ? 'Creating...' : 'Play Local (2 players, one device)'}
              </button>
              
              {searching && searchingGameId ? (
                <div className="text-center">
                  <p className="mb-4">Searching for an opponent...</p>
                  <button className="btn w-full" onClick={handleCancelSearch}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn w-full mb-4" onClick={handlePlayOnline} disabled={searching}>
                  {searching ? 'Searching...' : 'Play Online (matchmaking)'}
                </button>
              )}

              <button className="btn w-full mb-4" onClick={handleCreateCodeGame} disabled={searching}>
                {searching ? 'Creating...' : 'Create Private Game (vs Friend)'}
              </button>
              <div className="flex gap-2 mb-2">
                <input
                  className="input flex-1"
                  placeholder="Enter code to join"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                />
                <button className="btn" onClick={() => {
                  if (joinCode) router.push(`/join/${joinCode}`);
                }}>
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
