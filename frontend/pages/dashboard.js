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

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (searchingGameId) {
      const channel = supabase
        .channel(`game_matchmaking:${searchingGameId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${searchingGameId}`
        }, (payload) => {
          const updatedGame = payload.new;
          if (updatedGame.opponent && updatedGame.status === 'in_progress') {
            setSearching(false);
            setSearchingGameId(null);
            toast.success('Opponent found! Starting game...');
            router.push(`/game/${updatedGame.id}`);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [searchingGameId, router]);

  async function handleCreateLocalGame() {
    router.push('/local-game');
  }

  async function handleCreateCodeGame() {
    if (!user || !user.id) { toast.error("You must be logged in to create a game."); return; }
    const inviteCode = generateInviteCode();
    try {
      const { data, error } = await supabase
        .from('games')
        .insert({ 
          status: 'waiting', 
          invite_code: inviteCode, 
          creator: user.id, 
          players_joined: 1, 
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          white_time_left: 600, // 10 minutes in seconds
          black_time_left: 600,
          last_move_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      router.push(`/game/${data.id}`);
    } catch (error) {
      toast.error("Error creating private game: " + error.message);
    }
  }

  async function handlePlayOnline() {
    if (!user || !user.id) { toast.error("You must be logged in to play online."); return; }
    setSearching(true);
    setSearchingGameId(null);

    try {
      // First try to find an existing game
      const { data: existingGames, error: searchError } = await supabase
        .from('games')
        .select('id')
        .eq('status', 'waiting')
        .is('invite_code', null)
        .neq('creator', user.id)
        .is('opponent', null)
        .limit(1);

      if (searchError) throw searchError;

      if (existingGames && existingGames.length > 0) {
        // Join existing game
        const gameId = existingGames[0].id;
        const { error: joinError } = await supabase
          .from('games')
          .update({ 
            opponent: user.id,
            status: 'in_progress',
            players_joined: 2,
            last_move_at: new Date().toISOString()
          })
          .eq('id', gameId);

        if (joinError) throw joinError;
        
        setSearching(false);
        toast.success('Game found! Joining...');
        router.push(`/game/${gameId}`);
      } else {
        // Create new game
        const { data: newGame, error: createError } = await supabase
          .from('games')
          .insert({
            creator: user.id,
            status: 'waiting',
            players_joined: 1,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            white_time_left: 600,
            black_time_left: 600,
            last_move_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        
        setSearchingGameId(newGame.id);
      }
    
    } catch (error) {
      console.error("Error in handlePlayOnline:", error);
      toast.error("Matchmaking error: " + error.message);
      setSearching(false);
      setSearchingGameId(null);
    }
  }

  async function handleCancelSearch() {
    setSearching(false);
    if (searchingGameId) {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', searchingGameId)
        .eq('status', 'waiting'); // Only delete if it's still waiting
      if (error) {
        toast.error('Error cancelling search: ' + error.message);
      }
    }
    setSearchingGameId(null);
  }

  if (loading || !user) {
    return null; // AuthProvider shows the loading spinner
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-10 flex flex-col items-center justify-start">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold">Chess Masters</h1>
          <p className="text-gray-400 mt-2">A project by Vedanshu</p>
        </div>
        <h2 className="text-2xl font-semibold mb-6">Welcome, {user.profile?.username || user.email}</h2>
        <div className="w-full max-w-sm">
          <button className="btn btn-primary w-full mb-4" onClick={() => setShowStartModal(true)}>
            Start a New Game
          </button>
        </div>

        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400 hover:text-white" onClick={() => setShowStartModal(false)}>✕</button>
              <h2 className="text-2xl font-bold mb-6 text-center">Choose Your Game</h2>
              
              {searching ? (
                <div className="text-center py-4">
                  <p className="mb-4 text-lg">Searching for an opponent...</p>
                  <div className="flex justify-center items-center mb-4">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <button className="btn btn-secondary w-full" onClick={handleCancelSearch}>
                    Cancel Search
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button className="btn btn-primary w-full" onClick={handlePlayOnline}>
                    Play Online (Matchmaking)
                  </button>
                  <button className="btn btn-secondary w-full" onClick={handleCreateCodeGame}>
                    Create Private Game (vs Friend)
                  </button>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 bg-gray-700 border-gray-600"
                      placeholder="Enter friend's code"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      name="joinCode"
                      autoComplete="off"
                    />
                    <button className="btn btn-accent" onClick={() => {
                      if (joinCode) router.push(`/join/${joinCode.trim()}`);
                    }}>
                      Join
                    </button>
                  </div>
                  <hr className="border-gray-600 my-4"/>
                  <button className="btn btn-info w-full" onClick={handleCreateLocalGame}>
                    Play Local (On this Device)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}