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

    // Initialize all state variables at the top level
    const [game, setGame] = useState(null);
    const [chess, setChess] = useState(() => new Chess());
    const [fen, setFen] = useState(() => chess.fen());
    const [history, setHistory] = useState([]);
    const [fenError, setFenError] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [gameOver, setGameOver] = useState({ over: false, reason: '', winner: null });
    const [whitePlayer, setWhitePlayer] = useState({ username: 'Player 1' });
    const [blackPlayer, setBlackPlayer] = useState({ username: 'Player 2' });
    const [playerColor, setPlayerColor] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [pendingMove, setPendingMove] = useState(null);
    const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
    const [isClient, setIsClient] = useState(false);

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
    const handlePromotion = useCallback(async (promotionPiece) => {
        if (!pendingMove || !chess) {
            setShowPromotionModal(false);
            return;
        }

        try {
            const { from, to } = pendingMove;
            const move = chess.move({ from, to, promotion: promotionPiece });
            
            if (move) {
                const newFen = chess.fen();
                setFen(newFen);
                setHistory(chess.history({ verbose: true }));
                setCapturedPieces(calculateCapturedPieces(newFen));
                
                // Update the game state in Supabase
                if (game?.id) {
                    const { error } = await supabase
                        .from('games')
                        .update({
                            fen: newFen,
                            last_move: JSON.stringify(move),
                            last_move_at: new Date().toISOString()
                        })
                        .eq('id', game.id);
                        
                    if (error) throw error;
                }
            }
        } catch (error) {
            console.error('Error in promotion:', error);
            toast.error('Failed to promote pawn. Please try again.');
        } finally {
            setShowPromotionModal(false);
            setPendingMove(null);
        }
    }, [chess, pendingMove, game?.id]);

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

        const { data, error } = await supabase
            .from('games')
            .update({ 
                fen: newFen, 
                last_move_at: new Date().toISOString(), 
                status: newStatus, 
                winner,
                winner_by
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
        const shouldRunTimer = timerShouldRun && isTurn && bothPlayersJoined;
        const timeLeft = color === 'w' ? game.white_time_left : game.black_time_left;
        
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
                    key={`${color}-${timeLeft}-${shouldRunTimer}`}
                    initialTime={timeLeft} 
                    isRunning={shouldRunTimer} 
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