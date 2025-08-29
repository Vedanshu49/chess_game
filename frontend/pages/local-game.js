import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/NavBar";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import { Chess } from 'chess.js';
import CapturedPieces from "@/components/CapturedPieces";
import MoveList from "@/components/MoveList";
import Timer from "@/components/Timer";
import PromotionModal from "@/components/PromotionModal";

const LocalChessboard = dynamic(() => import('@/components/LocalChessboard'), { ssr: false });

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

export default function LocalGamePage() {
  const [chess, setChess] = useState(null);
  const [fen, setFen] = useState('start');
  const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [lastMoveTime, setLastMoveTime] = useState(Date.now());
  const [gameStatus, setGameStatus] = useState('in_progress');
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [pendingPromotionMove, setPendingPromotionMove] = useState(null);

  useEffect(() => {
    const loadChess = async () => {
      try {
        const { Chess } = await import('chess.js');
        const newChess = new Chess();
        setChess(newChess);
        setFen(newChess.fen());
        setHistory(newChess.history());
      } catch (error) {
        toast.error("Failed to load chess engine.");
        console.error("Error loading chess.js:", error);
      }
    };
    loadChess();
  }, []);

  useEffect(() => {
    if (gameStatus === 'in_progress') {
      const timer = setInterval(() => {
        const now = Date.now();
        const timeDiff = (now - lastMoveTime) / 1000;

        if (chess) {
          if (chess.turn() === 'w') {
            setWhiteTime(prev => {
              const newTime = prev - timeDiff;
              if (newTime <= 0) {
                setGameStatus('timeout');
                toast.success('Time out! Black wins!');
                return 0;
              }
              return newTime;
            });
          } else {
            setBlackTime(prev => {
              const newTime = prev - timeDiff;
              if (newTime <= 0) {
                setGameStatus('timeout');
                toast.success('Time out! White wins!');
                return 0;
              }
              return newTime;
            });
          }
        }
        setLastMoveTime(now);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStatus, lastMoveTime, chess]);

  const handleMove = async ({ sourceSquare, targetSquare }) => {
    if (!chess || gameStatus !== 'in_progress') return;

    const piece = chess.get(sourceSquare);
    const targetRank = targetSquare[1];
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1');

    // Check for promotion scenario first
    if (isPawn && isPromotionRank) {
      let tempMove = null;
      try {
        tempMove = chess.move({ from: sourceSquare, to: targetSquare });
        chess.undo(); // Undo the temporary move
      } catch (e) {
        // This catch block is for chess.js errors, not invalid moves
      }

      if (tempMove === null) {
        // Promotion is required
        setPendingPromotionMove({ sourceSquare, targetSquare });
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

      // Check for game over conditions
      if (chess.in_checkmate()) {
        setGameStatus('checkmate');
        toast.success(`Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} wins!`);
      } else if (chess.in_draw()) {
        setGameStatus('draw');
        toast.info('Draw!');
      } else if (chess.in_stalemate()) {
        setGameStatus('stalemate');
        toast.info('Stalemate!');
      } else if (chess.in_threefold_repetition()) {
        setGameStatus('draw');
        toast.info('Draw by threefold repetition!');
      } else if (chess.insufficient_material()) {
        setGameStatus('draw');
        toast.info('Draw by insufficient material!');
      }

    } catch (error) {
      console.error('Error during move:', error);
      console.error('Source Square:', sourceSquare, 'Target Square:', targetSquare);
      toast.error('An unexpected error occurred during move.');
    }
  };

  const handlePromotion = (promotionPiece) => {
    if (!chess || !pendingPromotionMove) return;

    try {
      const { sourceSquare, targetSquare } = pendingPromotionMove;
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotionPiece,
      });

      if (move === null) {
        toast.error('Invalid promotion move!');
        // This should ideally not happen if the initial move was valid
        // and promotion was correctly detected.
        return;
      }

      // Update game state after successful promotion
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

      // Check for game over conditions
      if (chess.in_checkmate()) {
        setGameStatus('checkmate');
        toast.success(`Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} wins!`);
      } else if (chess.in_draw()) {
        setGameStatus('draw');
        toast.info('Draw!');
      } else if (chess.in_stalemate()) {
        setGameStatus('stalemate');
        toast.info('Stalemate!');
      } else if (chess.in_threefold_repetition()) {
        setGameStatus('draw');
        toast.info('Draw by threefold repetition!');
      } else if (chess.insufficient_material()) {
        setGameStatus('draw');
        toast.info('Draw by insufficient material!');
      }

    } catch (error) {
      console.error('Error during promotion:', error);
      toast.error('An unexpected error occurred during promotion.');
    } finally {
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
    }
  };

  const handleResign = (playerColor) => {
    if (window.confirm(`Are you sure you want to resign?`)) {
      setGameStatus('resigned');
      toast.success(`${playerColor === 'white' ? 'White' : 'Black'} resigned. ${playerColor === 'white' ? 'Black' : 'White'} wins!`);
    }
  };

  const handleNewGame = () => {
    try {
      const newChess = new Chess();
      setChess(newChess);
      setFen(newChess.fen());
      setCapturedPieces({ w: {}, b: {} });
      setHistory(newChess.history());
      setWhiteTime(600);
      setBlackTime(600);
      setLastMoveTime(Date.now());
      setGameStatus('in_progress');
      toast.success('New game started!');
    } catch (error) {
      console.error("Error starting new game:", error);
      toast.error("Failed to start new game.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white p-4 flex flex-col lg:flex-row items-center lg:items-start justify-center">
        <div className="w-full lg:w-auto flex justify-center items-center p-2 lg:flex-grow">
          <div className="w-[90vh] max-w-[90vw] aspect-square">
            {chess && <LocalChessboard fen={fen} onMove={handleMove} />}
          </div>
        </div>
        <div className="w-full lg:w-96 bg-gray-900 p-4 rounded-lg mt-4 lg:mt-0 lg:ml-4 flex-shrink-0">
          <h2 className="text-2xl font-bold mb-4">Local Game Info</h2>
          <div className="space-y-4">
            <Timer initialTime={whiteTime} isRunning={gameStatus === 'in_progress' && chess?.turn() === 'w'} />
            <Timer initialTime={blackTime} isRunning={gameStatus === 'in_progress' && chess?.turn() === 'b'} />
            <CapturedPieces captured={capturedPieces.b} color="white" />
            <CapturedPieces captured={capturedPieces.w} color="black" />
            <MoveList history={history} />
            <div>
              <h3 className="font-bold">Status</h3>
              <p>{gameStatus}</p>
            </div>
            <div>
              <h3 className="font-bold">Turn</h3>
              <p>{chess ? (chess.turn() === 'w' ? 'White' : 'Black') : ''}</p>
            </div>
            <div>
              <h3 className="font-bold">Players</h3>
              <p className={chess && chess.turn() === 'w' ? 'text-yellow-400 font-semibold' : ''}>White: Player 1</p>
              <p className={chess && chess.turn() === 'b' ? 'text-yellow-400 font-semibold' : ''}>Black: Player 2</p>
            </div>
            <button
              className="btn w-full mt-4 bg-green-600 hover:bg-green-700"
              onClick={handleNewGame}
            >
              New Game
            </button>
            {gameStatus === 'in_progress' && (
              <div className="flex gap-2 mt-2">
                <button
                  className="btn flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => handleResign('white')}
                >
                  White Resigns
                </button>
                <button
                  className="btn flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => handleResign('black')}
                >
                  Black Resigns
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showPromotionModal && pendingPromotionMove && (
        <PromotionModal
          onSelectPromotion={handlePromotion}
          color={chess.turn() === 'w' ? 'black' : 'white'} // Color of the pawn being promoted
        />
      )}
    </>
  );
}