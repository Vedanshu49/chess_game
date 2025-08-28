import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import Navbar from "../../components/NavBar";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import { Chess } from 'chess.js';
import CapturedPieces from "../../components/CapturedPieces";
import MoveList from "../../components/MoveList";
import Timer from "../../components/Timer";
import Chat from "../../components/Chat";

const LocalChessboard = dynamic(() => import('../../components/LocalChessboard'), { ssr: false });

const initialPieces = {
  p: 8, r: 2, n: 2, b: 2, q: 1, k: 1
};

function calculateCapturedPieces(fen) {
  const captured = { w: {}, b: {} };
  if (!fen) return captured;

  const piecesOnBoard = {
    w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
    b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
  };

  fen.split(' ')[0].split('/').forEach(row => {
    for (const char of row) {
      if (isNaN(parseInt(char))) { // if it is a piece
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const piece = char.toLowerCase();
        if (piecesOnBoard[color][piece] !== undefined) {
          piecesOnBoard[color][piece]++;
        }
      }
    }
  });

  for (const color of ['w', 'b']) {
    for (const piece in initialPieces) {
      const diff = initialPieces[piece] - piecesOnBoard[color][piece];
      if (diff > 0) {
        captured[color][piece] = diff;
      }
    }
  }

  return captured;
}

export default function GamePage() {
  const router = useRouter();
  const { id: gameId } = router.query;
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(null);
  const [chess, setChess] = useState(null);
  const [fen, setFen] = useState('start');
  const [loading, setLoading] = useState(true);
  const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [lastMoveTime, setLastMoveTime] = useState(Date.now());

  useEffect(() => {
    const loadChess = async () => {
      const { Chess } = await import('chess.js');
      setChess(new Chess());
    };
    loadChess();
  }, []);

  const loadGame = useCallback(async (session) => {
    if (!gameId) return;

    const { data: gameData, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !gameData) {
      toast.error('Game not found or an error occurred.');
      router.replace('/dashboard');
      return;
    }

    setGame(gameData);
    setFen(gameData.fen);
    setCapturedPieces(calculateCapturedPieces(gameData.fen));
    setWhiteTime(gameData.white_time_left);
    setBlackTime(gameData.black_time_left);
    setLastMoveTime(new Date(gameData.last_move_at).getTime());

    if (chess) {
      chess.load(gameData.fen);
      setHistory(chess.history());
    }
    setLoading(false);
  }, [gameId, router, chess]);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
        loadGame(session);
      }
    }
    loadUser();
  }, [router, loadGame]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        const newGame = payload.new;
        setGame(newGame);
        setFen(newGame.fen);
        setCapturedPieces(calculateCapturedPieces(newGame.fen));
        setWhiteTime(newGame.white_time_left);
        setBlackTime(newGame.black_time_left);
        setLastMoveTime(new Date(newGame.last_move_at).getTime());
        if (chess) {
          chess.load(newGame.fen);
          setHistory(chess.history());
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, chess]);

  const handleMove = async ({ sourceSquare, targetSquare }) => {
    if (!chess || !game || !user) return;

    const isWhite = game.creator === user.id;
    const isBlack = game.opponent === user.id;

    if ((chess.turn() === 'w' && !isWhite) || (chess.turn() === 'b' && !isBlack)) {
      toast.error("It's not your turn!");
      return;
    }

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) {
        toast.error('Invalid move!');
        return;
      }

      const newFen = chess.fen();
      const newHistory = chess.history();
      const moveTime = Date.now();
      const timeDiff = (moveTime - lastMoveTime) / 1000;
      const newWhiteTime = chess.turn() === 'b' ? whiteTime - timeDiff : whiteTime;
      const newBlackTime = chess.turn() === 'w' ? blackTime - timeDiff : blackTime;

      setFen(newFen);
      setCapturedPieces(calculateCapturedPieces(newFen));
      setHistory(newHistory);
      setWhiteTime(newWhiteTime);
      setBlackTime(newBlackTime);
      setLastMoveTime(moveTime);

      const { error } = await supabase
        .from('games')
        .update({
          fen: newFen,
          white_time_left: newWhiteTime,
          black_time_left: newBlackTime,
          last_move_at: new Date(moveTime).toISOString(),
        })
        .eq('id', gameId);

      if (error) {
        toast.error('Error saving move: ' + error.message);
        chess.undo();
        setFen(chess.fen());
        setCapturedPieces(calculateCapturedPieces(chess.fen()));
        setHistory(chess.history());
      }
    } catch (error) {
      console.log('Invalid move:', error);
      toast.error('An unexpected error occurred.');
    }
  };

  const handleResign = async () => {
    if (!game || !user) return;

    if (window.confirm('Are you sure you want to resign?')) {
      const winner = game.creator === user.id ? game.opponent : game.creator;
      const { error } = await supabase
        .from('games')
        .update({ status: 'finished', winner: winner })
        .eq('id', gameId);

      if (error) {
        toast.error('Error resigning: ' + error.message);
      } else {
        toast.success('You have resigned. The opponent wins.');
      }
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
          <div className="text-lg">Loading Game...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="bottom-center" />
      <Navbar />
      <div className="min-h-screen bg-black text-white p-4 flex flex-col lg:flex-row items-center lg:items-start justify-center">
        <div className="w-full lg:w-auto flex justify-center items-center p-2 lg:flex-grow">
          <div className="w-[90vh] max-w-[90vw] aspect-square">
            <LocalChessboard fen={fen} onMove={handleMove} />
          </div>
        </div>
        <div className="w-full lg:w-96 bg-gray-900 p-4 rounded-lg mt-4 lg:mt-0 lg:ml-4 flex-shrink-0">
          <h2 className="text-2xl font-bold mb-4">Game Info</h2>
          <div className="space-y-4">
            <Timer initialTime={whiteTime} isRunning={chess.turn() === 'w'} />
            <Timer initialTime={blackTime} isRunning={chess.turn() === 'b'} />
            <CapturedPieces captured={capturedPieces.b} color="white" />
            <CapturedPieces captured={capturedPieces.w} color="black" />
            <MoveList history={history} />
            {user && <Chat gameId={gameId} user={user} />}
            <div>
              <h3 className="font-bold">Status</h3>
              <p>{game.status}</p>
            </div>
            <div>
              <h3 className="font-bold">Turn</h3>
              <p>{chess ? (chess.turn() === 'w' ? 'White' : 'Black') : ''}</p>
            </div>
            <div>
              <h3 className="font-bold">Players</h3>
              <p>White: {game.creator_username || 'Player 1'}</p>
              <p>Black: {game.opponent_username || 'Player 2'}</p>
            </div>
            {game.status === 'local' && (
              <button
                className="btn w-full mt-4"
                onClick={() => router.push('/dashboard')}
              >
                Leave Match
              </button>
            )}
            {game.status === 'in_progress' && (
              <button
                className="btn w-full mt-4 bg-red-600 hover:bg-red-700"
                onClick={handleResign}
              >
                Resign
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
