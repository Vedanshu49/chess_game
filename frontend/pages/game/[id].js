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
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionMove, setPromotionMove] = useState(null); // To store { from, to }

  useEffect(() => {
    const loadChess = async () => {
      const { Chess } = await import('chess.js');
      setChess(new Chess());
    };
    loadChess();
  }, []);

  const loadGame = useCallback(async (session) => {
    if (!gameId) return;

    try {
      const { data: gameData, error } = await supabase
        .from('games')
        .select('*, players_joined') // Include players_joined
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
    } catch (error) {
      console.error("Error loading game:", error);
      toast.error("Failed to load game data.");
      router.replace('/dashboard');
    }
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

  useEffect(() => {
    if (chess && fen) {
      try {
        chess.load(fen);
        setHistory(chess.history());
      } catch (e) {
        console.error("Error loading FEN into chess.js for history:", e);
      }
    }
  }, [chess, fen]);

  // Navigation Guard
  useEffect(() => {
    const warnBeforeLeaving = (e) => {
      if (game && game.status === 'in_progress') {
        const confirmationMessage = 'You have an active game. Are you sure you want to leave?';
        e.returnValue = confirmationMessage; // Standard for browser confirmation
        return confirmationMessage; // For some older browsers
      }
    };

    const handleRouteChangeStart = (url) => {
      if (game && game.status === 'in_progress') {
        // If the user is trying to navigate away from the game page
        // and the game is in progress, show a confirmation.
        // This will prevent navigation if the user cancels the confirm.
        if (!window.confirm('You have an active game. Are you sure you want to leave?')) {
          router.events.emit('routeChangeError'); // Prevent route change
          throw 'routeChange aborted.'; // Throw to stop the navigation
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', warnBeforeLeaving);
    router.events.on('routeChangeStart', handleRouteChangeStart);

    // Clean up event listeners on component unmount
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [game, router]); // Depend on 'game' to react to status changes, and 'router'

  const handleMove = async ({ sourceSquare, targetSquare }) => {
    if (!chess || !game || !user) return;

    const isWhite = game.creator === user.id;
    const isBlack = game.opponent === user.id;

    if ((chess.turn() === 'w' && !isWhite) || (chess.turn() === 'b' && !isBlack)) {
      toast.error("It's not your turn!");
      return;
    }

    const piece = chess.get(sourceSquare);
    const targetRank = targetSquare[1];
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1');

    // Check for promotion scenario first
    if (isPawn && isPromotionRank) {
      // Temporarily try the move to see if it's legal without promotion specified
      // If it's not legal, it means promotion is required.
      // This is a bit of a hack, but chess.js doesn't have a direct "isPromotionRequired" method.
      let tempMove = null;
      try {
        tempMove = chess.move({ from: sourceSquare, to: targetSquare });
        chess.undo(); // Undo the temporary move
      } catch (e) {
        // This catch block is for chess.js errors, not invalid moves
      }

      if (tempMove === null) {
        // Promotion is required
        setPromotionMove({ sourceSquare, targetSquare });
        setShowPromotionModal(true);
        return; // Stop handleMove here, wait for promotion selection
      }
    }

    // If not a promotion, or if it's a promotion that doesn't require a choice (e.g., only one legal promotion)
    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Default to queen if not a promotion requiring choice
      });

      if (move === null) {
        toast.error('Invalid move! Please check piece movement rules, blocked paths, or if your King is in check.');
        return;
      }

      const newFen = chess.fen();
      const newHistory = chess.history();
      const moveTime = Date.now();
      const timeDiff = (moveTime - lastMoveTime) / 1000;
      const newWhiteTime = Math.floor(chess.turn() === 'b' ? whiteTime - timeDiff : whiteTime);
      const newBlackTime = Math.floor(chess.turn() === 'w' ? blackTime - timeDiff : blackTime);

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

  const handlePromotion = async (promotedPiece) => {
    if (!chess || !game || !user || !promotionMove) return;

    setShowPromotionModal(false); // Hide modal

    try {
      const move = chess.move({
        from: promotionMove.sourceSquare,
        to: promotionMove.targetSquare,
        promotion: promotedPiece,
      });

      if (move === null) {
        toast.error('Invalid promotion move!');
        return;
      }

      const newFen = chess.fen();
      const newHistory = chess.history();
      const moveTime = Date.now();
      const timeDiff = (moveTime - lastMoveTime) / 1000;
      const newWhiteTime = Math.floor(chess.turn() === 'b' ? whiteTime - timeDiff : whiteTime);
      const newBlackTime = Math.floor(chess.turn() === 'w' ? blackTime - timeDiff : blackTime);

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
      console.log('Error during promotion:', error);
      toast.error('An unexpected error occurred during promotion.');
    } finally {
      setPromotionMove(null); // Clear promotion move details
    }
  };

  const handleResign = async () => {
    if (!game || !user) return;

    if (window.confirm('Are you sure you want to resign?')) {
      const winner = game.creator === user.id ? game.opponent : game.creator;
      try {
        const { error } = await supabase
          .from('games')
          .update({ status: 'finished', winner: winner })
          .eq('id', gameId);

        if (error) {
          toast.error('Error resigning: ' + error.message);
        } else {
          toast.success('You have resigned. The opponent wins.');
        }
      } catch (error) {
        console.error("Error resigning:", error);
        toast.error("An unexpected error occurred during resignation.");
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
            {game?.players_joined < 2 ? (
              <div className="text-center text-lg font-semibold text-yellow-400">
                Waiting for opponent...
              </div>
            ) : (
              <> 
                <Timer initialTime={blackTime} isRunning={game?.players_joined === 2 && game.status === 'in_progress' && chess?.turn() === 'b'} />
                <Timer initialTime={whiteTime} isRunning={game?.players_joined === 2 && game.status === 'in_progress' && chess?.turn() === 'w'} />
              </>
            )}

            {game?.invite_code && game?.players_joined < 2 && (
              <div className="text-center bg-blue-800 p-2 rounded-md">
                <p className="text-white font-semibold">Invite Code:</p>
                <p className="text-3xl font-bold text-yellow-300">{game.invite_code}</p>
                <p className="text-sm text-gray-300">Share this code with your friend!</p>
              </div>
            )}

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
              <p className={chess && chess.turn() === 'w' ? 'text-yellow-400 font-semibold' : ''}>White: {game.creator_username || 'Player 1'}</p>
              <p className={chess && chess.turn() === 'b' ? 'text-yellow-400 font-semibold' : ''}>Black: {game.opponent_username || 'Player 2'}</p>
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
      {showPromotionModal && promotionMove && (
        <PromotionModal
          onSelectPromotion={handlePromotion}
          color={chess.turn() === 'w' ? 'black' : 'white'} // Color of the pawn being promoted
        />
      )}
    </>
  );
}
