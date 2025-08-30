import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabasejs';
import { useAuth } from '@/lib/AuthProvider';
import toast from 'react-hot-toast';
import { Chess } from 'chess.js';
import { calculateCapturedPieces } from '@/lib/utils';

export const useOnlineGame = (gameId) => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Engine + game state
  const [chess, setChess] = useState(() => new Chess());
  const [game, setGame] = useState(null);
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [history, setHistory] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
  const [gameOver, setGameOver] = useState({ over: false, reason: '', winner: null });

  // Players and timing
  const [whitePlayer, setWhitePlayer] = useState({ username: 'Player 1' });
  const [blackPlayer, setBlackPlayer] = useState({ username: 'Player 2' });
  const [playerColor, setPlayerColor] = useState(null);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  // UI flags
  const [isClient, setIsClient] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [fenError, setFenError] = useState(null);
  const [lastGoodFen, setLastGoodFen] = useState(fen);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [awaitingPromotion, setAwaitingPromotion] = useState(false);

  const [isMyTurn, setIsMyTurn] = useState(false);

  // Derived
  const bothPlayersJoined = useMemo(() => !!(game?.creator && game?.opponent), [game]);

  // Set client flag
  useEffect(() => setIsClient(true), []);

  // Update isMyTurn when relevant
  useEffect(() => {
    if (!chess || !playerColor || gameOver.over) {
      setIsMyTurn(false);
      return;
    }
    setIsMyTurn(chess.turn() === playerColor);
  }, [chess, playerColor, gameOver.over]);

  // Initialize chess instance on mount
  useEffect(() => {
    setChess(new Chess());
  }, []);

  // Load game from DB
  const fetchGameData = useCallback(async () => {
    if (!gameId || !user) return;
    try {
      setPageLoading(true);
      const { data: gameData, error } = await supabase
        .from('games')
        .select(`
          *,
          creator_profile:profiles!creator(username, rating),
          opponent_profile:profiles!opponent(username, rating)
        `)
        .eq('id', gameId)
        .single();

      if (error || !gameData) {
        toast.error('Game not found.');
        router.replace('/dashboard');
        return;
      }

      setGame(gameData);

      if (!gameData.fen) {
        const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        await supabase.from('games').update({ fen: startingFen }).eq('id', gameId);
      }

      const userIsCreator = gameData.creator === user.id;
      const userIsOpponent = gameData.opponent === user.id;
      const color = userIsCreator ? 'w' : (userIsOpponent ? 'b' : null);
      setPlayerColor(color);

      setWhitePlayer(gameData.creator_profile || { username: 'Player 1' });
      setBlackPlayer(gameData.opponent_profile || { username: 'Waiting...' });

      if (gameData.status === 'finished') {
        setGameOver({ over: true, reason: gameData.winner_by, winner: gameData.winner });
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
      toast.error('Failed to load game.');
    } finally {
      setPageLoading(false);
    }
  }, [gameId, user, router]);

  useEffect(() => { if (!authLoading) fetchGameData(); }, [authLoading, fetchGameData]);

  // Keep engine state synced to `game.fen`
  useEffect(() => {
    if (!game) return;
    try {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const incomingFen = typeof game.fen === 'string' && game.fen.trim() ? game.fen.trim() : startingFen;
      const validator = new Chess();
      const ok = validator.load(incomingFen);
      const newChess = new Chess();
      if (!ok) {
        // Incoming FEN was invalid. Fall back to lastGoodFen or starting position
        setFenError('Invalid FEN from server — loaded fallback position');
        const fallback = lastGoodFen || startingFen;
        try {
          newChess.load(fallback);
          setFen(fallback);
          setHistory(newChess.history({ verbose: true }));
          setCapturedPieces(calculateCapturedPieces(fallback));
        } catch (e) {
          newChess.reset();
          setFen(newChess.fen());
          setHistory([]);
          setCapturedPieces(calculateCapturedPieces(newChess.fen()));
        }
      } else {
        newChess.load(incomingFen);
        setLastGoodFen(incomingFen);
        setFen(incomingFen);
        setHistory(newChess.history({ verbose: true }));
        setCapturedPieces(calculateCapturedPieces(incomingFen));
        setFenError(null);
      }
      setChess(newChess);
      setFenError(null);
    } catch (error) {
      console.error('Failed to initialize chess with FEN:', error);
      const fallback = new Chess();
      fallback.reset();
      setChess(fallback);
      setFen(fallback.fen());
      setHistory([]);
      setCapturedPieces(calculateCapturedPieces(fallback.fen()));
      setFenError(null);
    }
  }, [game]);

  // Timer effect driven by game.last_move_at
  useEffect(() => {
    if (!game || gameOver.over || !chess || !bothPlayersJoined) return;

    setWhiteTime(game.white_time_left);
    setBlackTime(game.black_time_left);

    const interval = setInterval(() => {
      const now = new Date();
      const lastMoveAt = new Date(game.last_move_at);
      const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

      if (chess.turn() === 'w') {
        const remaining = game.white_time_left - elapsedSeconds;
        setWhiteTime(remaining > 0 ? remaining : 0);
        setBlackTime(game.black_time_left);
      } else {
        const remaining = game.black_time_left - elapsedSeconds;
        setBlackTime(remaining > 0 ? remaining : 0);
        setWhiteTime(game.white_time_left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [game, gameOver.over, chess, bothPlayersJoined]);

  // Real-time subscription
  useEffect(() => {
    if (!gameId || !chess) return;

    const channel = supabase.channel(`game:${gameId}`);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, async (payload) => {
      try {
        const newGame = payload.new;
        const oldGame = payload.old;

        // Validate incoming FEN quickly to set an error if needed;
        try {
          if (typeof newGame?.fen === 'string') {
            const v = new Chess();
            const ok = v.load(newGame.fen);
            if (!ok) setFenError('Invalid FEN received in realtime update');
            else setFenError(null);
          }
        } catch (e) {
          // continue — we'll let the main game effect handle the fallback
          console.warn('FEN validation error on realtime update', e);
        }

        setGame(newGame);

        if (oldGame.opponent === null && newGame.opponent !== null) {
          const { data: opponentProfile } = await supabase.from('profiles').select('username, rating').eq('id', newGame.opponent).single();
          setBlackPlayer(opponentProfile || { username: 'Player 2' });
          await supabase.from('games').update({ last_move_at: new Date().toISOString() }).eq('id', newGame.id);
        }

        if (newGame.status === 'finished') {
          setGameOver({ over: true, reason: newGame.winner_by, winner: newGame.winner });
          const winnerUsername = newGame.winner === newGame.creator ? whitePlayer.username : blackPlayer.username;
          let message = `Game over! ${winnerUsername} wins by ${newGame.winner_by}.`;
          if (newGame.winner === user?.id) toast.success(message); else toast.error(message);
        }
      } catch (err) {
        console.error('Realtime update handler error:', err);
      }
    });

    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId, chess, user, whitePlayer, blackPlayer]);

  // Update whose turn it is when fen or playerColor changes
  useEffect(() => {
    if (!chess || !playerColor) return;
    setIsMyTurn(chess.turn() === playerColor);
  }, [fen, playerColor, chess]);

  const updateBackendWithMove = useCallback(async (move) => {
    const newFen = chess.fen();
    let newStatus = game.status;
    let winner = null;
    let winner_by = null;

    if (chess.isGameOver()) {
      newStatus = 'finished';
      if (chess.isCheckmate()) winner_by = 'checkmate';
      else if (chess.isStalemate()) winner_by = 'stalemate';
      else if (chess.isDraw()) winner_by = 'draw';
      else if (chess.isThreefoldRepetition()) winner_by = 'repetition';
      else if (chess.isInsufficientMaterial()) winner_by = 'insufficient material';

      if (winner_by !== 'draw' && winner_by !== 'stalemate') {
        winner = move.color === 'w' ? game.creator : game.opponent;
      }
    }

    const now = new Date();
    const lastMoveAt = new Date(game.last_move_at);
    const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

    let newWhiteTime = game.white_time_left;
    let newBlackTime = game.black_time_left;

    if (move.color === 'w') {
      newWhiteTime = Math.max(0, game.white_time_left - elapsedSeconds);
      if (newWhiteTime === 0) {
        newStatus = 'finished';
        winner = game.opponent;
        winner_by = 'timeout';
      }
    } else {
      newBlackTime = Math.max(0, game.black_time_left - elapsedSeconds);
      if (newBlackTime === 0) {
        newStatus = 'finished';
        winner = game.creator;
        winner_by = 'timeout';
      }
    }

    const { error } = await supabase
      .from('games')
      .update({ 
        fen: newFen, 
        last_move: JSON.stringify(move),
        last_move_at: now.toISOString(), 
        status: newStatus, 
        winner,
        winner_by,
        white_time_left: newWhiteTime,
        black_time_left: newBlackTime
      })
      .eq('id', gameId);

    if (error) {
      toast.error('Failed to save move. Reverting.');
      chess.undo();
      setFen(chess.fen());
    }
  }, [chess, game, gameId]);

  const handleMove = useCallback(async ({ sourceSquare, targetSquare }) => {
    if (!chess || !isMyTurn || gameOver.over || !game?.id || awaitingPromotion) return false;
    try {
      const piece = chess.get(sourceSquare);
      if (!piece) { toast.error('No piece on selected square'); return false; }
      if (piece.color !== playerColor) { toast.error('You can only move your own pieces'); return false; }

      const isPawnPromotion = piece.type === 'p' && ((piece.color === 'w' && targetSquare[1] === '8') || (piece.color === 'b' && targetSquare[1] === '1'));

      if (isPawnPromotion) {
        const legalMoves = chess.moves({ square: sourceSquare, verbose: true });
        if (legalMoves.some(m => m.to === targetSquare)) {
          setPendingMove({ from: sourceSquare, to: targetSquare });
          setAwaitingPromotion(true);
          setShowPromotionModal(true);
          return true;
        }
      }

      const move = chess.move({ from: sourceSquare, to: targetSquare });
      if (!move) {
        if (chess.in_check()) toast.error('That move leaves your king in check');
        else toast.error('That move is not allowed');
        return false;
      }

      const now = new Date();
      const newFen = chess.fen();

      setFen(newFen);
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(newFen));

      const moveTimestamp = now.toISOString();
      const lastMoveAt = new Date(game.last_move_at);
      const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

      const newWhiteTime = move.color === 'w' ? Math.max(0, game.white_time_left - elapsedSeconds) : game.white_time_left;
      const newBlackTime = move.color === 'b' ? Math.max(0, game.black_time_left - elapsedSeconds) : game.black_time_left;

      const gameUpdate = {
        fen: newFen,
        last_move: JSON.stringify(move),
        last_move_at: moveTimestamp,
        white_time_left: newWhiteTime,
        black_time_left: newBlackTime
      };

      if (chess.isCheckmate()) {
        Object.assign(gameUpdate, { status: 'finished', winner: move.color === 'w' ? game.creator : game.opponent, winner_by: 'checkmate' });
        setGameOver({ over: true, reason: 'checkmate', winner: move.color === 'w' ? game.creator : game.opponent });
      } else if (chess.isDraw()) {
        Object.assign(gameUpdate, { status: 'finished', winner_by: 'draw' });
        setGameOver({ over: true, reason: 'draw', winner: null });
      }

      const { error } = await supabase.from('games').update(gameUpdate).eq('id', game.id);
      if (error) throw error;

      setLastGoodFen(newFen);
      return true;
    } catch (error) {
      console.error('Move error:', error);
      toast.error('Failed to make move');
      chess.load(fen);
      setFen(chess.fen());
      try { setLastGoodFen(fen); } catch (e) {}
      return false;
    }
  }, [chess, isMyTurn, gameOver.over, playerColor, game, fen, awaitingPromotion]);

  const handlePromotion = useCallback(async (pieceType) => {
    if (pieceType === null) {
      setShowPromotionModal(false);
      setPendingMove(null);
      setAwaitingPromotion(false);
      return false;
    }

    if (!pendingMove || !chess || !game?.id) return false;

    try {
      const { from, to } = pendingMove;
      const move = chess.move({ from, to, promotion: pieceType });
      if (!move) { toast.error('Invalid promotion move'); return false; }

      const now = new Date();
      const newFen = chess.fen();

      setFen(newFen);
      setHistory(chess.history({ verbose: true }));
      setCapturedPieces(calculateCapturedPieces(newFen));

      const moveTimestamp = now.toISOString();
      const lastMoveAt = new Date(game.last_move_at);
      const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

      const newWhiteTime = move.color === 'w' ? Math.max(0, game.white_time_left - elapsedSeconds) : game.white_time_left;
      const newBlackTime = move.color === 'b' ? Math.max(0, game.black_time_left - elapsedSeconds) : game.black_time_left;

      const gameUpdate = {
        fen: newFen,
        last_move: JSON.stringify(move),
        last_move_at: moveTimestamp,
        white_time_left: newWhiteTime,
        black_time_left: newBlackTime
      };

      if (chess.isCheckmate()) {
        Object.assign(gameUpdate, { status: 'finished', winner: move.color === 'w' ? game.creator : game.opponent, winner_by: 'checkmate' });
        setGameOver({ over: true, reason: 'checkmate', winner: move.color === 'w' ? game.creator : game.opponent });
      } else if (chess.isDraw()) {
        Object.assign(gameUpdate, { status: 'finished', winner_by: 'draw' });
        setGameOver({ over: true, reason: 'draw', winner: null });
      }

      const { error } = await supabase.from('games').update(gameUpdate).eq('id', game.id);
      if (error) throw error;

      setLastGoodFen(newFen);
      return true;
    } catch (error) {
      console.error('Promotion error:', error);
      toast.error('Failed to promote pawn');
      chess.load(fen);
      setFen(chess.fen());
      return false;
    } finally {
      setShowPromotionModal(false);
      setPendingMove(null);
      setAwaitingPromotion(false);
    }
  }, [pendingMove, chess, game, fen]);

  const handleResign = useCallback(async () => {
    if (gameOver.over) { router.push('/dashboard'); return; }
    if (!game.opponent) { router.push('/dashboard'); return; }
    if (!window.confirm('Are you sure you want to resign?')) return;
    try {
      const winner = playerColor === 'w' ? game.opponent : game.creator;
      setGameOver({ over: true, reason: 'resignation', winner });
      const { error } = await supabase.from('games').update({ status: 'finished', winner, winner_by: 'resignation', last_move_at: new Date().toISOString(), fen: chess.fen() }).eq('id', game.id);
      if (error) throw error;
      toast.success('Game resigned successfully');
      router.push('/dashboard');
    } catch (error) {
      console.error('Resign error:', error);
      toast.error('Unable to resign. Please try again.');
    }
  }, [game, gameOver.over, playerColor, chess, router]);

  return {
    chess,
    game,
    fen,
    history,
    capturedPieces,
    gameOver,
    whitePlayer,
    blackPlayer,
  user,
  authLoading,
    playerColor,
    whiteTime,
    blackTime,
    isClient,
    pageLoading,
    fenError,
    showPromotionModal,
    awaitingPromotion,
    pendingMove,
    isMyTurn,
    bothPlayersJoined,
    handleMove,
    handlePromotion,
    handleResign,
    fetchGameData,
  };
};
