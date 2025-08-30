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
    const router = useRouter();
    const { id: gameId } = router.query;
    const { user, loading: authLoading } = useAuth();

    // Game engine state
    const [chess] = useState(() => {
        try {
            return new Chess();
        } catch (error) {
            console.error('Failed to initialize chess engine:', error);
            return null;
        }
    });

    // Game state
    const [game, setGame] = useState(null);
    const [fen, setFen] = useState('start');
    const [history, setHistory] = useState([]);
    const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
    const [gameOver, setGameOver] = useState({ over: false, reason: '', winner: null });
    
    // Player state
    const [whitePlayer, setWhitePlayer] = useState({ username: 'Player 1' });
    const [blackPlayer, setBlackPlayer] = useState({ username: 'Player 2' });
    const [playerColor, setPlayerColor] = useState(null);
    
    // Timer state
    const [whiteTime, setWhiteTime] = useState(600);
    const [blackTime, setBlackTime] = useState(600);
    const [lastMoveTime, setLastMoveTime] = useState(Date.now());
    
    // UI state
    const [isClient, setIsClient] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [fenError, setFenError] = useState(null);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [pendingMove, setPendingMove] = useState(null);
    
    // Derived state
    const isMyTurn = useMemo(() => {
        if (!chess || !playerColor || gameOver.over) return false;
        return chess.turn() === playerColor;
    }, [chess, playerColor, gameOver.over]);

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

    // Block route changes in SPA unless resigned or game not started
    useEffect(() => {
        const handleRouteChange = (url) => {
            // Allow navigation if:
            // 1. Game is over
            // 2. Second player hasn't joined
            // 3. User is just spectating
            if (gameOver.over || !game?.opponent || !playerColor) {
                return;
            }
            
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
    }, [gameOver.over, router, game?.opponent, playerColor]);

    // Handle pawn promotion
    const handlePromotion = useCallback(async (pieceType) => {
        console.log('Handling promotion:', { pieceType, pendingMove });
        
        if (!pendingMove || !chess || !game?.id) {
            console.error('Invalid promotion state:', { 
                hasPendingMove: !!pendingMove, 
                hasChess: !!chess,
                hasGameId: !!game?.id
            });
            return false;
        }

        try {
            const { from, to } = pendingMove;
            const move = chess.move({
                from,
                to,
                promotion: pieceType
            });

            if (!move) {
                console.error('Failed to make promotion move');
                toast.error('Invalid promotion move');
                return false;
            }

            const now = new Date();
            const newFen = chess.fen();
            
            // Update local state
            setFen(newFen);
            setHistory(chess.history({ verbose: true }));
            setCapturedPieces(calculateCapturedPieces(newFen));

            // Calculate elapsed time
            const moveTimestamp = now.toISOString();
            const lastMoveAt = new Date(game.last_move_at);
            const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

            // Update time remaining
            const newWhiteTime = move.color === 'w' 
                ? Math.max(0, game.white_time_left - elapsedSeconds)
                : game.white_time_left;
                
            const newBlackTime = move.color === 'b'
                ? Math.max(0, game.black_time_left - elapsedSeconds)
                : game.black_time_left;

            // Prepare game update
            const gameUpdate = {
                fen: newFen,
                last_move: JSON.stringify(move),
                last_move_at: moveTimestamp,
                white_time_left: newWhiteTime,
                black_time_left: newBlackTime
            };

            // Check for game-ending conditions
            if (chess.isCheckmate()) {
                Object.assign(gameUpdate, {
                    status: 'finished',
                    winner: move.color === 'w' ? game.creator : game.opponent,
                    winner_by: 'checkmate'
                });
                setGameOver({
                    over: true,
                    reason: 'checkmate',
                    winner: move.color === 'w' ? game.creator : game.opponent
                });
            } else if (chess.isDraw()) {
                Object.assign(gameUpdate, {
                    status: 'finished',
                    winner_by: 'draw'
                });
                setGameOver({
                    over: true,
                    reason: 'draw',
                    winner: null
                });
            }

            // Update database
            const { error } = await supabase
                .from('games')
                .update(gameUpdate)
                .eq('id', game.id);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Promotion error:', error);
            toast.error('Failed to promote pawn');
            // Reset to previous state if needed
            chess.load(fen);
            setFen(chess.fen());
            return false;
        } finally {
            setShowPromotionModal(false);
            setPendingMove(null);
        }
    }, [pendingMove, chess, game, fen]);    useEffect(() => {
        setIsClient(true);
    }, []);

    // Timer update effect
    useEffect(() => {
        if (!game || gameOver.over || !chess) {
            return;
        }

        // Initialize timer state from the game object
        setWhiteTime(game.white_time_left);
        setBlackTime(game.black_time_left);

        const interval = setInterval(() => {
            const now = new Date();
            const lastMoveAt = new Date(game.last_move_at);
            const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

            if (chess.turn() === 'w') {
                const remaining = game.white_time_left - elapsedSeconds;
                setWhiteTime(remaining > 0 ? remaining : 0);
                setBlackTime(game.black_time_left); // Black's time is static
            } else {
                const remaining = game.black_time_left - elapsedSeconds;
                setBlackTime(remaining > 0 ? remaining : 0);
                setWhiteTime(game.white_time_left); // White's time is static
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [game, gameOver.over, chess]);

    // Initialize chess.js
    useEffect(() => {
        setChess(new Chess());
    }, []);

    // Initialize game data
    const fetchGameData = useCallback(async () => {
        if (!gameId || !user || !chess) return;

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
                console.error('Game fetch error:', error);
                toast.error('Game not found.');
                router.replace('/dashboard');
                return;
            }

            setGame(gameData);
            const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
                        
                        // For new games or invalid states, use starting position
                        if (!gameData.fen) {
                            // New game - set up starting position
                            chess.load(startingFen);
                            setFen(startingFen);
                            setHistory([]);
                            setCapturedPieces({ w: {}, b: {} });

                            // Update the game with starting position
                            const { data: updatedGame, error: updateError } = await supabase
                                .from('games')
                                .update({ fen: startingFen })
                                .eq('id', gameId)
                                .select()
                                .single();

                            if (updateError) {
                                console.error('Error updating initial game state:', updateError);
                            } else {
                                setGame(updatedGame);
                            }
                        } else {
                            try {
                                // Try to load existing game state
                                chess.load(gameData.fen);
                                setFen(gameData.fen);
                                setHistory(chess.history({ verbose: true }));
                                setCapturedPieces(calculateCapturedPieces(gameData.fen));
                            } catch (e) {
                                // If loading fails, reset to starting position
                                console.error('Error loading game state, resetting to start:', e);
                                chess.load(startingFen);
                                setFen(startingFen);
                                setHistory([]);
                                setCapturedPieces({ w: {}, b: {} });
                                
                                // Update database with corrected state
                                await supabase
                                    .from('games')
                                    .update({ fen: startingFen })
                                    .eq('id', gameId);
                            }
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
                const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
                try {
                    // Let chess.js handle FEN validation
                    chess.load(newGame.fen || startingFen);
                    setFen(newGame.fen || startingFen);
                    setHistory(chess.history({ verbose: true }));
                    setCapturedPieces(calculateCapturedPieces(newGame.fen || startingFen));
                    setFenError(null);
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
                    setGameOver({ over: true, reason: newGame.winner_by, winner: newGame.winner });
                    const winnerUsername = newGame.winner === newGame.creator ? whitePlayer.username : blackPlayer.username;
                    let message = `Game over! ${winnerUsername} wins by ${newGame.winner_by}.`;
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

        // Update the time for the player who just moved
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

        const { data, error } = await supabase
            .from('games')
            .update({ 
                fen: newFen, 
                last_move_at: now.toISOString(), 
                status: newStatus, 
                winner,
                winner_by,
                white_time_left: newWhiteTime,
                black_time_left: newBlackTime
            })
            .eq('id', gameId)
            .select()
            .single();

        if (error) {
            toast.dismiss();
            toast.error('Failed to save move. Reverting.');
            chess.undo();
            setFen(chess.fen());
        }
    }, [chess, game, gameId, setFen]);

    const handleMove = useCallback(async ({ sourceSquare, targetSquare }) => {
        console.log('Move attempted:', { sourceSquare, targetSquare });
        
        if (!chess || !isMyTurn || gameOver.over || !game?.id) {
            console.log('Move rejected:', { 
                hasChess: !!chess, 
                isMyTurn, 
                isGameOver: gameOver.over 
            });
            return false;
        }

        try {
            // Get the piece and validate basic move conditions
            const piece = chess.get(sourceSquare);
            if (!piece) {
                toast.error("No piece on selected square");
                return false;
            }
            
            if (piece.color !== playerColor) {
                toast.error("You can only move your own pieces");
                return false;
            }

            // Check if this could be a pawn promotion
            const isPawnPromotion = 
                piece.type === 'p' && 
                ((piece.color === 'w' && targetSquare[1] === '8') || 
                 (piece.color === 'b' && targetSquare[1] === '1'));

            if (isPawnPromotion) {
                // Verify it's a legal promotion move first
                const legalMoves = chess.moves({ 
                    square: sourceSquare, 
                    verbose: true 
                });
                
                if (legalMoves.some(m => m.to === targetSquare)) {
                    console.log('Initiating pawn promotion');
                    setPendingMove({ from: sourceSquare, to: targetSquare });
                    setShowPromotionModal(true);
                    return true;
                }
            }

            // Regular move
            const move = chess.move({
                from: sourceSquare,
                to: targetSquare
            });

            if (!move) {
                console.log('Invalid move detected');
                if (chess.in_check()) {
                    toast.error("That move leaves your king in check");
                } else {
                    toast.error("That move is not allowed");
                }
                return false;
            }

            const now = new Date();
            const newFen = chess.fen();
            
            // Update local state
            setFen(newFen);
            setHistory(chess.history({ verbose: true }));
            setCapturedPieces(calculateCapturedPieces(newFen));

            // Calculate elapsed time
            const moveTimestamp = now.toISOString();
            const lastMoveAt = new Date(game.last_move_at);
            const elapsedSeconds = Math.floor((now - lastMoveAt) / 1000);

            // Update time remaining
            const newWhiteTime = move.color === 'w' 
                ? Math.max(0, game.white_time_left - elapsedSeconds)
                : game.white_time_left;
                
            const newBlackTime = move.color === 'b'
                ? Math.max(0, game.black_time_left - elapsedSeconds)
                : game.black_time_left;

            // Prepare game update
            const gameUpdate = {
                fen: newFen,
                last_move: JSON.stringify(move),
                last_move_at: moveTimestamp,
                white_time_left: newWhiteTime,
                black_time_left: newBlackTime
            };

            // Check for game-ending conditions
            if (chess.isCheckmate()) {
                Object.assign(gameUpdate, {
                    status: 'finished',
                    winner: move.color === 'w' ? game.creator : game.opponent,
                    winner_by: 'checkmate'
                });
                setGameOver({
                    over: true,
                    reason: 'checkmate',
                    winner: move.color === 'w' ? game.creator : game.opponent
                });
            } else if (chess.isDraw()) {
                Object.assign(gameUpdate, {
                    status: 'finished',
                    winner_by: 'draw'
                });
                setGameOver({
                    over: true,
                    reason: 'draw',
                    winner: null
                });
            }

            // Update database
            const { error } = await supabase
                .from('games')
                .update(gameUpdate)
                .eq('id', game.id);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Move error:', error);
            toast.error('Failed to make move');
            // Reset to previous state if needed
            chess.load(fen);
            setFen(chess.fen());
            return false;
        }
    }, [chess, isMyTurn, gameOver.over, playerColor, game, fen]);

    // HandlePromotion is already defined above

    const handleResign = async () => {
        if (gameOver.over) {
            router.push('/dashboard');
            return;
        }

        // If second player hasn't joined, allow leaving without resignation
        if (!game.opponent) {
            router.push('/dashboard');
            return;
        }

        if (!window.confirm('Are you sure you want to resign?')) return;

        try {
            const winner = playerColor === 'w' ? game.opponent : game.creator;
            setGameOver({ over: true, reason: 'resignation', winner });
            
            const { data, error } = await supabase
                .from('games')
                .update({
                    status: 'finished',
                    winner,
                    winner_by: 'resignation',
                    last_move_at: new Date().toISOString(),
                    fen: chess.fen()
                })
                .eq('id', game.id)
                .select()
                .single();

            if (error) throw error;

            // If successful, show success message and redirect
            toast.success('Game resigned successfully');
            router.push('/dashboard');
        } catch (error) {
            console.error('Resign error:', error);
            toast.dismiss();
            toast.error('Unable to resign. Please try again.');
        }
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

    const PlayerInfo = ({ player, color, isTurn }) => {
        const timeLeft = color === 'w' ? whiteTime : blackTime;
        
        return (
            <div className={`p-3 rounded-lg ${isTurn ? 'bg-blue-600' : 'bg-gray-700'} transition-colors duration-300`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
                    <div>
                        <h3 className="font-bold text-lg">{player?.username || '...'}</h3>
                        <p className="text-sm text-gray-300">Rating: {player?.rating || 'N/A'}</p>
                    </div>
                </div>
                <Timer 
                    player={player}
                    timeLeft={timeLeft}
                    isActive={isTurn && !gameOver.over}
                />
                <CapturedPieces captured={capturedPieces[color === 'w' ? 'b' : 'w']} />
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <Navbar />
            <div className="flex-grow flex lg:flex-row flex-col gap-4 p-4">
                <div className="w-full lg:w-64 flex-shrink-0">
                    <PlayerInfo player={whitePlayer} color="w" isTurn={chess?.turn() === 'w'} />
                </div>
                
                <div className="flex-grow flex justify-center items-start">
                    <div className="w-full max-w-[75vh] aspect-square">
                        {isClient && <Chessboard 
                            position={fen}
                            onDrop={handleMove}
                            orientation={playerColor || 'white'}
                            draggable={!gameOver.over && isMyTurn}
                        />}
                    </div>
                </div>

                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                    <PlayerInfo player={blackPlayer} color="b" isTurn={chess?.turn() === 'b'} />
                    <div className="bg-panel p-4 rounded-lg shadow-lg">
                        <MoveList history={history} />
                        {!gameOver.over && (
                            <button
                                onClick={handleResign}
                                className="mt-4 w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold"
                            >
                                Resign
                            </button>
                        )}
                    </div>
                    {game && <Chat gameId={game.id} user={user} />}
                </div>
            </div>

            {showPromotionModal && (
                <PromotionModal
                    onSelectPromotion={handlePromotion}
                    color={playerColor}
                />
            )}
            
            {/* Game Code Display */}
            {game && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg text-center">
                    <h3 className="text-lg font-semibold mb-2 text-white">Share Game Code</h3>
                    <div className="flex items-center justify-center space-x-2">
                        <code className="bg-gray-700 px-4 py-2 rounded text-white font-mono text-xl">
                            {game.invite_code}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(game.invite_code);
                                toast.success('Game code copied to clipboard!');
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}
            <Toaster />
        </div>
    );
}