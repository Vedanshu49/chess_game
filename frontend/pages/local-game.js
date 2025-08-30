import { useEffect, useState, useCallback, useMemo } from "react";
import Navbar from "@/components/NavBar";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import { Chess } from 'chess.js';
import CapturedPieces from "@/components/CapturedPieces";
import MoveList from "@/components/MoveList";
import Timer from "@/components/Timer";
import PromotionModal from "@/components/PromotionModal";
import { calculateCapturedPieces } from "@/lib/utils";
import { useRouter } from 'next/router';

const LocalChessboard = dynamic(() => import('@/components/LocalChessboard'), { ssr: false });



export default function LocalGamePage() {
  const router = useRouter();
  
  // Core game state
  const [chess, setChess] = useState(() => new Chess());
  const [gameStatus, setGameStatus] = useState('in_progress');
  const [lastMoveTime, setLastMoveTime] = useState(Date.now());
  
  // UI state
  const [fen, setFen] = useState(() => chess.fen());
  const [history, setHistory] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [pendingPromotionMove, setPendingPromotionMove] = useState(null);
  
  // Timer state
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  
  // Game info for display
  const [whitePlayer] = useState({ username: 'White' });
  const [blackPlayer] = useState({ username: 'Black' });

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

  // Timer Effect
  useEffect(() => {
    if (gameStatus !== 'in_progress' || !chess) {
      return;
    }

    let timeoutId;
    const updateTimer = () => {
      const currentTime = Date.now();
      const isWhiteTurn = chess.turn() === 'w';
      
      if (isWhiteTurn) {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 1);
          if (newTime === 0) {
            setGameStatus('timeout');
            toast.success('Time out! Black wins!');
          }
          return newTime;
        });
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 1);
          if (newTime === 0) {
            setGameStatus('timeout');
            toast.success('Time out! White wins!');
          }
          return newTime;
        });
      }
      
      if (gameStatus === 'in_progress') {
        timeoutId = setTimeout(updateTimer, 1000);
      }
    };

    timeoutId = setTimeout(updateTimer, 1000);
    return () => clearTimeout(timeoutId);
  }, [gameStatus, chess, chess?.turn()]);

  const handleMove = useCallback(({ sourceSquare, targetSquare }) => {
    if (!chess || gameStatus !== 'in_progress') {
      toast.error(gameStatus !== 'in_progress' ? 'Game is over!' : 'Chess engine not initialized');
      return false;
    }

    try {
      // Check if this is a pawn promotion move
      const piece = chess.get(sourceSquare);
      if (piece?.type === 'p') {
        const isPromotion = (piece.color === 'w' && targetSquare[1] === '8') || 
                           (piece.color === 'b' && targetSquare[1] === '1');
        
        if (isPromotion) {
          const legalMoves = chess.moves({ square: sourceSquare, verbose: true });
          if (legalMoves.some(m => m.to === targetSquare)) {
            setPendingPromotionMove({ from: sourceSquare, to: targetSquare });
            setShowPromotionModal(true);
            return true;
          }
        }
      }

      // Regular move
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Default to queen for any automatic promotions
      });

      if (!move) {
        toast.error('Invalid move!');
        return false;
      }

      // Update game state
      setFen(chess.fen());
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(chess.fen()));
      setLastMoveTime(Date.now());

      // Check game ending conditions
      checkGameEnd();
      
      return true;
    } catch (error) {
      console.error('Move error:', error);
      toast.error('An error occurred while making the move');
      return false;
    }
  }, [chess, gameStatus]);

  const handlePromotion = useCallback((promotionPiece) => {
    if (!chess || !pendingPromotionMove || gameStatus !== 'in_progress') {
      toast.error('Cannot process promotion at this time');
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
      return;
    }

    try {
      const move = chess.move({
        from: pendingPromotionMove.from,
        to: pendingPromotionMove.to,
        promotion: promotionPiece
      });

      if (!move) {
        throw new Error('Invalid promotion move');
      }

      // Update game state
      setFen(chess.fen());
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(chess.fen()));
      setLastMoveTime(Date.now());

      // Check game ending conditions
      checkGameEnd();
    } catch (error) {
      console.error('Promotion error:', error);
      toast.error(error.message || 'Failed to promote pawn');
      chess.load(fen); // Reset to previous position
    } finally {
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
    }
  }, [chess, pendingPromotionMove, gameStatus, fen]);

  const updateGameState = (move) => {
    const newFen = chess.fen();
    const newHistory = chess.history({ verbose: true });
    
    // Time is now handled by the timer effect
    setFen(newFen);
    setCapturedPieces(calculateCapturedPieces(newFen));
    setHistory(newHistory);

    // Check for game-ending conditions
    if (whiteTime <= 0) {
      setGameStatus('timeout');
      toast.success('Time out! Black wins!');
    } else if (blackTime <= 0) {
      setGameStatus('timeout');
      toast.success('Time out! White wins!');
    } else {
      checkGameOver();
    }
  };

  const checkGameEnd = useCallback(() => {
    if (!chess) return;

    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'Black' : 'White';
      setGameStatus('checkmate');
      toast.success(`Checkmate! ${winner} wins!`);
    } else if (chess.isDraw()) {
      setGameStatus('draw');
      if (chess.isStalemate()) {
        toast.info('Game Over - Stalemate!');
      } else if (chess.isInsufficientMaterial()) {
        toast.info('Game Over - Insufficient Material!');
      } else if (chess.isThreefoldRepetition()) {
        toast.info('Game Over - Threefold Repetition!');
      } else {
        toast.info('Game Over - Draw!');
      }
    }
  }, [chess]);

  const handleResign = useCallback((color) => {
    if (gameStatus !== 'in_progress') {
      toast.error('Cannot resign - game is already over');
      return;
    }

    if (window.confirm(`Are you sure you want to resign as ${color}?`)) {
      const winner = color === 'white' ? 'Black' : 'White';
      setGameStatus('resigned');
      toast.success(`${color} resigned. ${winner} wins!`);
    }
  }, [gameStatus]);

  const handleNewGame = useCallback(() => {
    try {
      const newChess = new Chess();
      setChess(newChess);
      setFen(newChess.fen());
      setHistory([]);
      setCapturedPieces({ w: {}, b: {} });
      setWhiteTime(600);
      setBlackTime(600);
      setLastMoveTime(Date.now());
      setGameStatus('in_progress');
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
      toast.success('New game started!');
    } catch (error) {
      console.error('Failed to start new game:', error);
      toast.error('Could not start new game. Please refresh the page.');
    }
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-bg text-text flex flex-col lg:flex-row lg:justify-center lg:items-start p-4 gap-4">
        <Toaster position="bottom-center" />
        <div className="flex-grow flex justify-center items-center">
          <div className="w-[90vh] max-w-[90vw] aspect-square shadow-lg rounded-lg overflow-hidden">
            {chess && <LocalChessboard fen={fen} onMove={handleMove} turn={chess.turn()} />}
          </div>
        </div>

        <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-panel p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Local Game</h2>
            <div className="flex flex-col sm:flex-row sm:justify-around mb-2 gap-2">
                <div className={`p-2 rounded ${chess && chess.turn() === 'w' ? 'bg-accent text-white' : ''}`}>
                    <Timer 
                        player={{ username: 'White' }}
                        timeLeft={whiteTime}
                        isActive={gameStatus === 'in_progress' && chess?.turn() === 'w'}
                    />
                </div>
                <div className={`p-2 rounded ${chess && chess.turn() === 'b' ? 'bg-accent text-white' : ''}`}>
                    <Timer 
                        player={{ username: 'Black' }}
                        timeLeft={blackTime}
                        isActive={gameStatus === 'in_progress' && chess?.turn() === 'b'}
                    />
                </div>
            </div>
            <div className="flex justify-between">
              <CapturedPieces captured={capturedPieces.b} color="white" />
              <CapturedPieces captured={capturedPieces.w} color="black" />
            </div>
            <div className="mt-4">
              <h3 className="font-bold">Status: <span className="font-normal">{gameStatus}</span></h3>
              <h3 className="font-bold">Turn: <span className="font-normal">{chess ? (chess.turn() === 'w' ? 'White' : 'Black') : 'N/A'}</span></h3>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn flex-1 bg-green-600 hover:bg-green-700" onClick={handleNewGame}>New Game</button>
              {gameStatus === 'in_progress' && (
                <>
                  <button className="btn flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleResign('white')}>White Resigns</button>
                  <button className="btn flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleResign('black')}>Black Resigns</button>
                </>
              )}
            </div>
          </div>
          <MoveList history={history} />
        </div>
      </div>
      {showPromotionModal && (
        <PromotionModal 
          onSelect={handlePromotion} 
          color={chess.turn() === 'w' ? 'w' : 'b'} 
        />
      )}
    </>
  );
}
