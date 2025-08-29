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

  const handleMove = useCallback((sourceSquare, targetSquare) => {
    if (!chess || gameStatus !== 'in_progress') return;

    const piece = chess.get(sourceSquare);
    if (!piece) return;

    const isPawn = piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && sourceSquare[1] === '7' && targetSquare[1] === '8') || 
                            (piece.color === 'b' && sourceSquare[1] === '2' && targetSquare[1] === '1');

    if (isPawn && isPromotionRank) {
        const moves = chess.moves({ square: sourceSquare, verbose: true });
        const move = moves.find(m => m.to === targetSquare);
        if (move) {
            setPendingPromotionMove({ from: sourceSquare, to: targetSquare });
            setShowPromotionModal(true);
            return; // Stop execution until user selects a promotion piece
        }
    }

    try {
        const move = chess.move({ from: sourceSquare, to: targetSquare });
        if (move === null) {
            toast.error('Invalid move!');
            return;
        }
        updateGameState(move);
    } catch (error) {
        console.error('Invalid move:', error);
        toast.error('That move is not allowed.');
    }
  }, [chess, gameStatus]);

  const handlePromotion = (promotionPiece) => {
    if (!chess || !pendingPromotionMove) return;

    try {
        const move = chess.move({ ...pendingPromotionMove, promotion: promotionPiece });
        if (move === null) {
            toast.error('Invalid promotion.');
            return;
        }
        updateGameState(move);
    } catch (error) {
        console.error('Promotion error:', error);
        toast.error('An error occurred during promotion.');
    } finally {
        setShowPromotionModal(false);
        setPendingPromotionMove(null);
    }
  };

  const updateGameState = (move) => {
    const newFen = chess.fen();
    const newHistory = chess.history({ verbose: true });
    const moveTime = Date.now();
    const timeDiff = (moveTime - lastMoveTime) / 1000;

    if (move.color === 'w') {
      setWhiteTime(prev => prev - timeDiff);
    } else {
      setBlackTime(prev => prev - timeDiff);
    }

    setFen(newFen);
    setCapturedPieces(calculateCapturedPieces(newFen));
    setHistory(newHistory);
    setLastMoveTime(moveTime);

    checkGameOver();
  };

  const checkGameOver = () => {
    if (chess.isCheckmate()) {
      setGameStatus('checkmate');
      toast.success(`Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} wins!`);
    } else if (chess.isDraw()) {
      setGameStatus('draw');
      toast.info('Draw!');
    } else if (chess.isStalemate()) {
      setGameStatus('stalemate');
      toast.info('Stalemate!');
    } else if (chess.isThreefoldRepetition()) {
      setGameStatus('draw');
      toast.info('Draw by threefold repetition!');
    } else if (chess.isInsufficientMaterial()) {
      setGameStatus('draw');
      toast.info('Draw by insufficient material!');
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
      setHistory(newChess.history({ verbose: true }));
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
            <div className="flex justify-around mb-2">
                <div className={`p-2 rounded ${chess && chess.turn() === 'w' ? 'bg-accent text-white' : ''}`}>
                    <h3 className="font-bold text-lg">White</h3>
                    <Timer initialTime={whiteTime} isRunning={gameStatus === 'in_progress' && chess?.turn() === 'w'} />
                </div>
                <div className={`p-2 rounded ${chess && chess.turn() === 'b' ? 'bg-accent text-white' : ''}`}>
                    <h3 className="font-bold text-lg">Black</h3>
                    <Timer initialTime={blackTime} isRunning={gameStatus === 'in_progress' && chess?.turn() === 'b'} />
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
