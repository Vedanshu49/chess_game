import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import { useAuth } from "@/lib/AuthProvider";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import { Chess } from 'chess.js';
import Navbar from "../../components/NavBar";
import CapturedPieces from "../../components/CapturedPieces";
import MoveList from "../../components/MoveList";
import Timer from "../../components/Timer";
import Chat from "../../components/Chat";
import PromotionModal from "../../components/PromotionModal";
import GameSkeleton from "../../components/GameSkeleton";
import { calculateCapturedPieces } from "../../lib/utils";

const Chessboard = dynamic(() => import('../../components/LocalChessboard'), { ssr: false });



export default function GamePage() {
    // Prevent navigation while game is in progress unless resigned
    useEffect(() => {
        if (!gameOver.over) {
            const handleBeforeUnload = (e) => {
                e.preventDefault();
                e.returnValue = '';
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [gameOver.over]);

    // Block route changes in SPA unless resigned
    useEffect(() => {
        if (!gameOver.over) {
            const handleRouteChange = (url) => {
                if (url !== router.asPath) {
                    toast.dismiss();
                    toast.error('You must resign before leaving the game.');
                    router.events.emit('routeChangeError');
                    throw 'Route change blocked.';
                }
            };
            router.events.on('routeChangeStart', handleRouteChange);
            return () => {
                router.events.off('routeChangeStart', handleRouteChange);
            };
        }
    }, [gameOver.over, router]);
    const router = useRouter();
    const { id: gameId } = router.query;
    const { user, loading: authLoading } = useAuth();

    const [game, setGame] = useState(null);
    const [chess, setChess] = useState(null);
        const [fen, setFen] = useState('start');
        const [fenError, setFenError] = useState(null);

        // Helper to validate FEN for 8x8 board
        function isValidFen(fen) {
            if (!fen) return false;
            const rows = fen.split(' ')[0].split('/');
            if (rows.length !== 8) return false;
            for (const row of rows) {
                let count = 0;
                for (const char of row) {
                    if (/[1-8]/.test(char)) count += parseInt(char);
                    else count += 1;
                }
                if (count !== 8) return false;
            }
            return true;
        }
    const [history, setHistory] = useState([]);
    const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
    const [playerColor, setPlayerColor] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [gameOver, setGameOver] = useState({ over: false, reason: '', winner: null });

    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [pendingMove, setPendingMove] = useState(null);

    const [whitePlayer, setWhitePlayer] = useState(null);
    const [blackPlayer, setBlackPlayer] = useState(null);

    const [pageLoading, setPageLoading] = useState(true);

    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Initialize chess.js
    useEffect(() => {
        setChess(new Chess());
    }, []);

    // Fetch game and player data
    const fetchGameData = useCallback(async () => {
        if (!gameId || !user || !chess) return;

        try {
            const { data: gameData, error } = await supabase
                .from('games')
                .select('*, creator_profile:profiles!creator(username, rating), opponent_profile:profiles!opponent(username, rating)')
                .eq('id', gameId)
                .single();

            if (error || !gameData) {
                toast.dismiss();
                toast.error('Game not found.');
                router.replace('/dashboard');
                return;
            }

                        setGame(gameData);
                        try {
                                if (!isValidFen(gameData.fen)) {
                                    console.error('Invalid FEN detected:', gameData.fen);
                                    setFenError('Invalid board state detected. Please contact support.');
                                    chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                                    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                                    setHistory(chess.history({ verbose: true }));
                                    setCapturedPieces(calculateCapturedPieces('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
                                } else {
                                    chess.load(gameData.fen);
                                    setFen(gameData.fen);
                                    setHistory(chess.history({ verbose: true }));
                                    setCapturedPieces(calculateCapturedPieces(gameData.fen));
                                    setFenError(null);
                                }
                        } catch (e) {
                                setFenError('Invalid board state detected. Please contact support.');
                        }

            const userIsCreator = gameData.creator === user.id;
            const userIsOpponent = gameData.opponent === user.id;
            const color = userIsCreator ? 'w' : (userIsOpponent ? 'b' : null);
            setPlayerColor(color);

            setWhitePlayer(gameData.creator_profile || { username: 'Player 1' });
            setBlackPlayer(gameData.opponent_profile || { username: 'Waiting...' });

            if (gameData.status === 'finished') {
                setGameOver({ over: true, reason: gameData.winner_reason, winner: gameData.winner });
            }

        } catch (err) {
            console.error("Error fetching game data:", err);
            toast.dismiss();
            toast.error("Failed to load game.");
        } finally {
            setPageLoading(false);
        }
    }, [gameId, user, chess, router]);

    useEffect(() => {
        if (!authLoading) fetchGameData();
    }, [authLoading, fetchGameData]);

    // Real-time subscription
    useEffect(() => {
        if (!gameId || !chess) return;

        const channel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, 
            async (payload) => {
                const newGame = payload.new;
                setGame(newGame);
                try {
                    if (!isValidFen(newGame.fen)) throw new Error('Invalid FEN');
                    chess.load(newGame.fen);
                    setFen(newGame.fen);
                    setHistory(chess.history({ verbose: true }));
                    setCapturedPieces(calculateCapturedPieces(newGame.fen));
                    setFenError(null);
                } catch (e) {
                    setFenError('Invalid board state detected. Please contact support.');
                }

                // Fetch opponent profile if they just joined
                if (payload.old.opponent === null && newGame.opponent !== null) {
                    const { data: opponentProfile } = await supabase.from('profiles').select('username, rating').eq('id', newGame.opponent).single();
                    setBlackPlayer(opponentProfile || { username: 'Player 2' });
                }

                if (newGame.status === 'finished') {
                    setGameOver({ over: true, reason: newGame.winner_reason, winner: newGame.winner });
                    const winnerUsername = newGame.winner === newGame.creator ? whitePlayer.username : blackPlayer.username;
                    let message = `Game over! ${winnerUsername} wins by ${newGame.winner_reason}.`;
                    if (newGame.winner === user?.id) {
                        toast.dismiss();
                        toast.success(message);
                    } else {
                        toast.dismiss();
                        toast.error(message);
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId, chess, user, whitePlayer, blackPlayer]);

    // Update whose turn it is
    useEffect(() => {
        if (!chess || !playerColor) return;
        setIsMyTurn(chess.turn() === playerColor);
    }, [fen, playerColor, chess]);


    const updateBackendWithMove = useCallback(async (move) => {
        const newFen = chess.fen();
        let newStatus = game.status;
        let winner = null;
        let winner_reason = null;

        if (chess.isGameOver()) {
            newStatus = 'finished';
            if (chess.isCheckmate()) winner_reason = 'checkmate';
            else if (chess.isStalemate()) winner_reason = 'stalemate';
            else if (chess.isDraw()) winner_reason = 'draw';
            else if (chess.isThreefoldRepetition()) winner_reason = 'repetition';
            else if (chess.isInsufficientMaterial()) winner_reason = 'insufficient material';
            
            if (winner_reason !== 'draw' && winner_reason !== 'stalemate') {
                winner = move.color === 'w' ? game.creator : game.opponent;
            }
        }

        const { error } = await supabase
            .from('games')
            .update({ fen: newFen, last_move_at: new Date().toISOString(), status: newStatus, winner, winner_reason })
            .eq('id', gameId);

        if (error) {
            toast.dismiss();
            toast.error('Failed to save move. Reverting.');
            chess.undo();
            setFen(chess.fen());
        }
    }, [chess, game, gameId, setFen]);

    const handleMove = useCallback(({ sourceSquare, targetSquare }) => {
        if (!chess || !isMyTurn || gameOver.over) return;

        try {
            const moves = chess.moves({ square: sourceSquare, verbose: true });
            const move = moves.find(m => m.to === targetSquare);

            if (!move) {
                // Context-specific error messages
                const piece = chess.get(sourceSquare);
                if (!piece) {
                    toast.dismiss();
                    toast.error("No piece on selected square.");
                } else if (piece.color !== playerColor) {
                    toast.dismiss();
                    toast.error("You cannot move your opponent's piece.");
                } else if (sourceSquare === targetSquare) {
                    toast.dismiss();
                    toast.error("You must select a destination square.");
                } else if (chess.get(targetSquare) && chess.get(targetSquare).color === playerColor) {
                    toast.dismiss();
                    toast.error("You cannot capture your own piece.");
                } else {
                    toast.dismiss();
                    toast.error("Invalid Move! This piece is blocked or move is not allowed.");
                }
                return;
            }

            // Is it a promotion?
            if (move.flags.includes('p')) {
                setPendingMove({ from: sourceSquare, to: targetSquare });
                setShowPromotionModal(true);
                return;
            }

            // Make the move
            const result = chess.move({ from: sourceSquare, to: targetSquare });
            if (!result) {
                if (chess.in_check()) {
                    toast.dismiss();
                    toast.error("You cannot place your King in check.");
                } else {
                    toast.dismiss();
                    toast.error("Unexpected error: move could not be completed.");
                }
                return;
            }
            updateBackendWithMove(result);
        } catch (err) {
            toast.dismiss();
            toast.error("Unexpected error during move: " + (err.message || err));
        }
    }, [chess, isMyTurn, gameOver.over, playerColor, updateBackendWithMove]);

    const handlePromotion = useCallback((promotionPiece) => {
        if (!chess || !pendingMove) return;
        const result = chess.move({ ...pendingMove, promotion: promotionPiece });
        if (result) updateBackendWithMove(result);
        setShowPromotionModal(false);
        setPendingMove(null);
    }, [chess, pendingMove, updateBackendWithMove]);

    const handleResign = async () => {
        if (gameOver.over || !window.confirm('Are you sure you want to resign?')) return;

        const winner = playerColor === 'w' ? game.opponent : game.creator;
        const { error } = await supabase
            .from('games')
            .update({ status: 'finished', winner: winner, winner_reason: 'resignation' })
            .eq('id', gameId);

        if (error) toast.dismiss();
        toast.error('Error resigning: ' + error.message);
    };

    if (pageLoading || authLoading) {
        return <GameSkeleton />;
    }
    if (fenError) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-500 text-xl">{fenError}</div>;
    }

    const bothPlayersJoined = game?.creator && game?.opponent;
    const firstMoveMade = history.length > 0;
    const timerShouldRun = !gameOver.over && isMyTurn && bothPlayersJoined && firstMoveMade;

    const PlayerInfo = ({ player, color, isTurn }) => (
        <div className={`p-3 rounded-lg ${isTurn ? 'bg-blue-600' : 'bg-gray-700'} transition-colors duration-300`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full"></div> {/* Placeholder for Avatar */}
                <div>
                    <h3 className="font-bold text-lg">{player?.username || '...'}</h3>
                    <p className="text-sm text-gray-300">Rating: {player?.rating || 'N/A'}</p>
                </div>
            </div>
            <Timer initialTime={color === 'w' ? game.white_time_left : game.black_time_left} isRunning={timerShouldRun && isTurn} />
            <CapturedPieces captured={capturedPieces[color === 'w' ? 'b' : 'w']} />
        </div>
    );

    return (
        <>