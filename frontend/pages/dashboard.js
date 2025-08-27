import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import Navbar from "../components/NavBar";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';

const LocalChessboard = dynamic(() => import('../components/LocalChessboard'), { ssr: false });

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
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    }
    loadUser();
  }, [router]);


  // Start Game Modal State
  const [showStartModal, setShowStartModal] = useState(false);
  const [startMode, setStartMode] = useState(null); // 'local', 'online', 'join'
  const [joinCode, setJoinCode] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleCreateCodeGame() {
    if (!user) { toast.error("You must be logged in to create a game."); return; }
    setSearching(true);
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('games')
      .insert({
        status: 'waiting',
        invite_code: inviteCode,
        creator: user.id,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        initial_time_seconds: 600, // 10 minutes
        white_time_left: 600,
        black_time_left: 600,
      })
      .select()
      .single();

    setSearching(false);

    if (error) {
      toast.error('Error creating game: ' + error.message);
      return;
    }

    if (data) {
      router.push(`/game/${data.id}`);
    }
  }

  async function handlePlayOnline() {
    if (!user) { toast.error("You must be logged in to play online."); return; }
    setSearching(true);

    // Try to find a waiting game
    const { data: waitingGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .is('opponent', null)
      .is('invite_code', null)
      .neq('creator', user.id) // Make sure we don't join our own game
      .limit(1)
      .single();

    if (findError && findError.code !== 'PGRST116') { // Ignore 'single row not found' error
      setSearching(false);
      toast.error('Error finding game: ' + findError.message);
      return;
    }

    if (waitingGame) {
      // Join the found game
      const { error: updateError } = await supabase
        .from('games')
        .update({ opponent: user.id, status: 'in_progress' })
        .eq('id', waitingGame.id);

      setSearching(false);

      if (updateError) {
        toast.error('Error joining game: ' + updateError.message);
        return;
      }
      router.push(`/game/${waitingGame.id}`);
    } else {
      // No waiting game found, create a new one
      const { data: newGame, error: createError } = await supabase
        .from('games')
        .insert({
          status: 'waiting',
          creator: user.id,
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          initial_time_seconds: 600, // 10 minutes
          white_time_left: 600,
          black_time_left: 600,
        })
        .select()
        .single();

      setSearching(false);

      if (createError) {
        toast.error('Error creating game: ' + createError.message);
        return;
      }

      if (newGame) {
        router.push(`/game/${newGame.id}`);
      }
    }
  }

  // Prevent SSR errors: only render dashboard if user is loaded
  if (!user) {
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
      <Toaster position="bottom-center" />
      <Navbar />
      <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-start">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Chess App</h1>
          <div className="text-xs text-gray-400 mt-1" style={{ whiteSpace: 'pre' }}>    A project by Vedanshu</div>
        </div>
        <h2 className="text-2xl font-bold mb-6">Welcome, {(user.user_metadata && user.user_metadata.username) ? user.user_metadata.username : user.email}</h2>
        <button className="btn mb-8" onClick={() => setShowStartModal(true)}>Start Game</button>
        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-[#1a2233] p-8 rounded-lg shadow-lg w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-white" onClick={() => setShowStartModal(false)}>✕</button>
              <h2 className="text-2xl font-bold mb-6 text-center">Start Game</h2>
              <button className="btn w-full mb-4" onClick={() => setStartMode('local')}>
                Play Local (2 players, one device)
              </button>
              <button className="btn w-full mb-4" onClick={handlePlayOnline} disabled={searching}>
                {searching ? 'Searching...' : 'Play Online (matchmaking)'}
              </button>
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
              {startMode === 'local' && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2 text-center">Local Chess Game</h3>
                  <LocalChessboard />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}