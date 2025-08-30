import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Chess } from 'chess.js';
import { calculateCapturedPieces } from '@/lib/utils';

export const useLocalGame = () => {
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
    if (gameStatus !== 'in_progress' || !chess) return;

    let timeoutId;
    const updateTimer = () => {
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

      if (gameStatus === 'in_progress') timeoutId = setTimeout(updateTimer, 1000);
    };

    timeoutId = setTimeout(updateTimer, 1000);
    return () => clearTimeout(timeoutId);
  }, [gameStatus, chess, chess?.turn()]);

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

  const handleMove = useCallback(({ sourceSquare, targetSquare }) => {
    if (!chess || gameStatus !== 'in_progress') {
      toast.error(gameStatus !== 'in_progress' ? 'Game is over!' : 'Chess engine not initialized');
      return false;
    }

    try {
      // Check if this is a pawn promotion move
      const piece = chess.get(sourceSquare);
      if (piece?.type === 'p') {
        const isPromotion = (piece.color === 'w' && targetSquare[1] === '8') || (piece.color === 'b' && targetSquare[1] === '1');
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
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) {
        toast.error('Invalid move!');
        return false;
      }

      setFen(chess.fen());
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(chess.fen()));
      setLastMoveTime(Date.now());

      checkGameEnd();
      return true;
    } catch (error) {
      console.error('Move error:', error);
      toast.error('An error occurred while making the move');
      return false;
    }
  }, [chess, gameStatus, checkGameEnd]);

  const handlePromotion = useCallback((promotionPiece) => {
    if (!chess || !pendingPromotionMove || gameStatus !== 'in_progress') {
      toast.error('Cannot process promotion at this time');
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
      return;
    }

    try {
      const move = chess.move({ from: pendingPromotionMove.from, to: pendingPromotionMove.to, promotion: promotionPiece });
      if (!move) throw new Error('Invalid promotion move');

      setFen(chess.fen());
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(chess.fen()));
      setLastMoveTime(Date.now());

      checkGameEnd();
    } catch (error) {
      console.error('Promotion error:', error);
      toast.error(error.message || 'Failed to promote pawn');
      chess.load(fen);
    } finally {
      setShowPromotionModal(false);
      setPendingPromotionMove(null);
    }
  }, [chess, pendingPromotionMove, gameStatus, fen, checkGameEnd]);

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

  return {
    chess,
    fen,
    history,
    capturedPieces,
    gameStatus,
    isGameOver: gameStatus !== 'in_progress',
    whiteTime,
    blackTime,
    showPromotionModal,
    pendingPromotionMove,
    handleMove,
    handlePromotion,
    handleNewGame,
    handleResign,
  };
};
